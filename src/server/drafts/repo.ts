import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "../db/client";
import { drafts } from "../db/schema";
import { logger } from "../logger";
import { AFFECTED, CATEGORIES, PRIORITIES, TICKET_KINDS } from "../rules/catalog";

export const DRAFT_KINDS = ["novo", "atualizacao", "reabertura"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];
export const DRAFT_STATUSES = ["aguardando_confirmacao", "confirmado", "cancelado", "substituido", "expirado"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const duplicateCheckSchema = z.object({
  considered: z.array(z.string()).catch([]),
  verdict: z.string().catch(""),
  why: z.string().catch(""),
});

export const draftPayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(TICKET_KINDS),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  affected: z.enum(AFFECTED),
  deadlineAt: z.string(),
  rule: z.string().catch(""),
  assumptions: z.array(z.string()).catch([]),
  targetTicket: z.string().nullable().optional().catch(null),
  note: z.string().nullable().optional().catch(null),
  newPriority: z.enum(PRIORITIES).nullable().optional().catch(null),
  duplicateCheck: duplicateCheckSchema.nullable().optional().catch(null),
  changes: z.string().nullable().optional().catch(null),
});
export type DraftPayload = z.infer<typeof draftPayloadSchema>;

export interface Draft {
  id: string;
  conversationId: string;
  displayCode: string;
  kind: DraftKind;
  status: DraftStatus;
  payload: DraftPayload;
  transferAfterDecision: boolean;
  resultingTicket: string | null;
  lastError: string | null;
  createdAt: string;
  decidedAt: string | null;
}

type Row = typeof drafts.$inferSelect;

function toDraft(row: Row): Draft {
  const payload = draftPayloadSchema.safeParse(row.payload);
  if (!payload.success) logger.warn("draft_payload_invalid", { draftId: row.id });
  return {
    id: row.id,
    conversationId: row.conversationId,
    displayCode: row.displayCode,
    kind: row.kind,
    status: row.status,
    payload: payload.success
      ? payload.data
      : ({ title: "Rascunho ilegível", description: "", type: "INC", category: "Outros", priority: "Média", affected: "somente_voce", deadlineAt: row.createdAt, rule: "", assumptions: [] } satisfies DraftPayload),
    transferAfterDecision: row.transferAfterDecision,
    resultingTicket: row.resultingTicket,
    lastError: row.lastError,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

export async function findDraft(db: AppDb, id: string): Promise<Draft | null> {
  const [row] = await db.select().from(drafts).where(eq(drafts.id, id));
  return row ? toDraft(row) : null;
}

export async function findPendingDraft(db: AppDb, conversationId: string): Promise<Draft | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.status, "aguardando_confirmacao")));
  return row ? toDraft(row) : null;
}

export async function listDrafts(db: AppDb, conversationIds: string[]): Promise<Draft[]> {
  if (conversationIds.length === 0) return [];
  const rows = await db
    .select()
    .from(drafts)
    .where(inArray(drafts.conversationId, conversationIds))
    .orderBy(asc(drafts.createdAt));
  return rows.map(toDraft);
}

const FIRST_DISPLAY_NUMBER = 381;

async function nextDisplayCode(db: AppDb): Promise<string> {
  const [row] = await db
    .select({ max: sql<number | null>`max(cast(substr(${drafts.displayCode}, 3) as integer))` })
    .from(drafts);
  return `D-${Math.max(FIRST_DISPLAY_NUMBER, (row?.max ?? 0) + 1)}`;
}

export interface NewDraft {
  conversationId: string;
  kind: DraftKind;
  payload: DraftPayload;
  transferAfterDecision?: boolean;
  createdAt: string;
}

/** Insere um rascunho pendente. Falha (índice único) se já houver outro pendente na conversa. */
export async function insertDraft(db: AppDb, input: NewDraft): Promise<Draft> {
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(drafts)
        .values({
          id: randomUUID(),
          conversationId: input.conversationId,
          displayCode: await nextDisplayCode(db),
          kind: input.kind,
          status: "aguardando_confirmacao",
          payload: input.payload,
          transferAfterDecision: input.transferAfterDecision ?? false,
          createdAt: input.createdAt,
        })
        .returning();
      if (!row) throw new Error("falha ao gravar rascunho");
      return toDraft(row);
    } catch (error) {
      const message = String((error as Error).message ?? error);
      if (attempt < 3 && message.includes("display_code")) continue;
      throw error;
    }
  }
}

/** Transição condicional: só muda se o status atual estiver em `from` (corrida de "Confirmar" duplo). */
export async function transitionDraft(
  db: AppDb,
  id: string,
  from: DraftStatus[],
  patch: { status?: DraftStatus; resultingTicket?: string | null; lastError?: string | null; decidedAt?: string | null; transferAfterDecision?: boolean },
): Promise<Draft | null> {
  const [row] = await db
    .update(drafts)
    .set(patch)
    .where(and(eq(drafts.id, id), inArray(drafts.status, from)))
    .returning();
  return row ? toDraft(row) : null;
}
