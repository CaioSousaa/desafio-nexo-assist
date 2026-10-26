import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "../db/client";
import { messages } from "../db/schema";
import { logger } from "../logger";
import { AFFECTED, PRIORITIES, TICKET_KINDS, TICKET_STATUSES } from "../rules/catalog";

export const ticketSummarySchema = z.object({
  number: z.string(),
  title: z.string(),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(PRIORITIES),
  category: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  overdue: z.boolean().catch(false),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

export const ticketCardSchema = ticketSummarySchema.extend({
  kind: z.enum(TICKET_KINDS).catch("INC"),
  description: z.string().catch(""),
  affected: z.enum(AFFECTED).optional().catch(undefined),
  resolvedAt: z.string().nullable().catch(null),
  deadlineAt: z.string().catch(""),
  lastUpdateText: z.string().catch(""),
  overdueByText: z.string().nullable().catch(null),
  ruleText: z.string().catch(""),
});
export type TicketCard = z.infer<typeof ticketCardSchema>;

export const caseSummarySchema = z.object({
  problem: z.string(),
  done: z.string().catch(""),
  tickets: z.array(z.string()).catch([]),
  priority: z.string().nullable().optional().catch(null),
  pendingDraft: z.string().nullable().optional().catch(null),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

/** Partes ricas de uma mensagem. Leitura tolerante: campo inválido vira ausente (compat-f). */
export const messagePartsSchema = z.object({
  quick_options: z.array(z.string()).optional().catch(undefined),
  ticket_list: z.array(ticketSummarySchema).optional().catch(undefined),
  ticket_card: ticketCardSchema.optional().catch(undefined),
  draft_id: z.string().optional().catch(undefined),
  limit_options: z.boolean().optional().catch(undefined),
  summary: caseSummarySchema.optional().catch(undefined),
  error_reason: z.string().optional().catch(undefined),
});
export type MessageParts = z.infer<typeof messagePartsSchema>;

export function parseParts(raw: unknown, context: { messageId?: string } = {}): MessageParts {
  if (raw === null || raw === undefined) return {};
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      logger.warn("message_parts_invalid_json", context);
      return {};
    }
  }
  const parsed = messagePartsSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn("message_parts_invalid", context);
    return {};
  }
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as MessageParts;
}

export type AuthorType = "funcionario" | "agent" | "analista" | "sistema";
export type SystemEventType = "transferida" | "assumida" | "devolvida" | "encerrada" | "limite" | "continuada" | "resolvida";
export type MessageStatus = "pending" | "done" | "error";

export interface Message {
  id: string;
  conversationId: string;
  authorType: AuthorType;
  authorId: string | null;
  text: string;
  parts: MessageParts;
  eventType: SystemEventType | null;
  decisionId: string | null;
  clientMessageId: string | null;
  status: MessageStatus | null;
  countsTowardLimit: boolean;
  createdAt: string;
}

type Row = typeof messages.$inferSelect;

function toMessage(row: Row): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    authorType: row.authorType,
    authorId: row.authorId,
    text: row.text,
    parts: parseParts(row.parts, { messageId: row.id }),
    eventType: row.eventType,
    decisionId: row.decisionId,
    clientMessageId: row.clientMessageId,
    status: row.status,
    countsTowardLimit: row.countsTowardLimit,
    createdAt: row.createdAt,
  };
}

export interface NewMessage {
  conversationId: string;
  authorType: AuthorType;
  authorId?: string | null;
  text?: string;
  parts?: MessageParts;
  eventType?: SystemEventType | null;
  decisionId?: string | null;
  clientMessageId?: string | null;
  status?: MessageStatus | null;
  countsTowardLimit?: boolean;
  createdAt: string;
}

/** Insere; com `clientMessageId` repetido na mesma conversa devolve a existente (`duplicate: true`). */
export async function insertMessage(db: AppDb, input: NewMessage): Promise<{ message: Message; duplicate: boolean }> {
  const id = randomUUID();
  const inserted = await db
    .insert(messages)
    .values({
      id,
      conversationId: input.conversationId,
      authorType: input.authorType,
      authorId: input.authorId ?? null,
      text: input.text ?? "",
      parts: input.parts && Object.keys(input.parts).length > 0 ? input.parts : null,
      eventType: input.eventType ?? null,
      decisionId: input.decisionId ?? null,
      clientMessageId: input.clientMessageId ?? null,
      status: input.status ?? null,
      countsTowardLimit: input.countsTowardLimit ?? false,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return { message: toMessage(inserted[0]), duplicate: false };
  if (!input.clientMessageId) throw new Error("falha ao inserir mensagem");
  const [existing] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, input.conversationId), eq(messages.clientMessageId, input.clientMessageId)));
  if (!existing) throw new Error("mensagem duplicada não encontrada");
  return { message: toMessage(existing), duplicate: true };
}

export async function updateMessage(
  db: AppDb,
  id: string,
  patch: Partial<Pick<Message, "text" | "parts" | "decisionId" | "status">>,
): Promise<Message | null> {
  const [row] = await db
    .update(messages)
    .set({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.parts !== undefined ? { parts: Object.keys(patch.parts).length > 0 ? patch.parts : null } : {}),
      ...(patch.decisionId !== undefined ? { decisionId: patch.decisionId } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    })
    .where(eq(messages.id, id))
    .returning();
  return row ? toMessage(row) : null;
}

export async function getMessage(db: AppDb, id: string): Promise<Message | null> {
  const [row] = await db.select().from(messages).where(eq(messages.id, id));
  return row ? toMessage(row) : null;
}

export async function listMessages(db: AppDb, conversationId: string): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(sql`rowid`));
  return rows.map(toMessage);
}

export async function listMessagesFor(db: AppDb, conversationIds: string[]): Promise<Map<string, Message[]>> {
  const result = new Map<string, Message[]>(conversationIds.map((id) => [id, []]));
  if (conversationIds.length === 0) return result;
  const rows = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, conversationIds))
    .orderBy(asc(messages.createdAt), asc(sql`rowid`));
  for (const row of rows) result.get(row.conversationId)?.push(toMessage(row));
  return result;
}

/** Mensagens do agent ainda `pending` (ex.: servidor caiu no meio de uma resposta). */
export async function listPendingAgentMessages(db: AppDb): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.authorType, "agent"), eq(messages.status, "pending")));
  return rows.map(toMessage);
}
