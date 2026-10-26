import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "../db/client";
import { conversations } from "../db/schema";
import { caseSummarySchema } from "../messages/repo";

export const CONVERSATION_STATES = ["com_agent", "aguardando_atendente", "com_analista", "encerrada"] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];
export type ConversationOutcome = "resolvida_pelo_agent" | "encerrada_pelo_analista" | "limite_atingido";
export type TransferReason = "pedido" | "critico" | "baixa_confianca" | "vencido" | "limite";

export const transferSummarySchema = caseSummarySchema.extend({
  reason: z.string().optional().catch(undefined),
  notConfirmed: z.boolean().optional().catch(undefined),
});
export type TransferSummary = z.infer<typeof transferSummarySchema>;

export interface Conversation {
  id: string;
  employeeId: string;
  state: ConversationState;
  outcome: ConversationOutcome | null;
  assignedAnalystId: string | null;
  transferReason: TransferReason | null;
  transferConfidence: number | null;
  transferSummary: TransferSummary | null;
  transferredAt: string | null;
  agentMessageCount: number;
  limitReached: boolean;
  inheritedSummary: string | null;
  previousConversationId: string | null;
  pendingTransfer: boolean;
  focusTicket: string | null;
  relatedTickets: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

type Row = typeof conversations.$inferSelect;

function toConversation(row: Row): Conversation {
  const summary = row.transferSummary ? transferSummarySchema.safeParse(row.transferSummary) : null;
  return {
    ...row,
    transferSummary: summary?.success ? summary.data : null,
    relatedTickets: Array.isArray(row.relatedTickets) ? row.relatedTickets.filter((t) => typeof t === "string") : [],
  };
}

export async function findConversation(db: AppDb, id: string): Promise<Conversation | null> {
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id));
  return row ? toConversation(row) : null;
}

export async function findOpenConversation(db: AppDb, employeeId: string): Promise<Conversation | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.employeeId, employeeId), ne(conversations.state, "encerrada")));
  return row ? toConversation(row) : null;
}

export async function listEmployeeConversations(db: AppDb, employeeId: string): Promise<Conversation[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.employeeId, employeeId))
    .orderBy(asc(conversations.createdAt), asc(sql`rowid`));
  return rows.map(toConversation);
}

export async function listAllConversations(db: AppDb): Promise<Conversation[]> {
  const rows = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  return rows.map(toConversation);
}

export interface NewConversation {
  id?: string;
  employeeId: string;
  createdAt: string;
  inheritedSummary?: string | null;
  previousConversationId?: string | null;
}

export async function insertConversation(db: AppDb, input: NewConversation): Promise<Conversation> {
  const [row] = await db
    .insert(conversations)
    .values({
      id: input.id ?? randomUUID(),
      employeeId: input.employeeId,
      state: "com_agent",
      agentMessageCount: 0,
      limitReached: false,
      pendingTransfer: false,
      relatedTickets: [],
      inheritedSummary: input.inheritedSummary ?? null,
      previousConversationId: input.previousConversationId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    .returning();
  if (!row) throw new Error("falha ao criar conversa");
  return toConversation(row);
}

export type ConversationPatch = Partial<Omit<Conversation, "id" | "employeeId" | "createdAt">>;

export interface ConversationGuard {
  states?: ConversationState[];
  /** `null` exige conversa sem analista; string exige aquele analista. */
  assignedAnalystId?: string | null;
}

/** Atualização condicional (uma instrução UPDATE, atômica no SQLite). Devolve null se a guarda falhou. */
export async function updateConversation(
  db: AppDb,
  id: string,
  patch: ConversationPatch,
  guard: ConversationGuard = {},
): Promise<Conversation | null> {
  if (Object.keys(patch).length === 0) return findConversation(db, id);
  const conditions: SQL[] = [eq(conversations.id, id)];
  if (guard.states) conditions.push(inArray(conversations.state, guard.states));
  if (guard.assignedAnalystId === null) conditions.push(isNull(conversations.assignedAnalystId));
  else if (guard.assignedAnalystId !== undefined) conditions.push(eq(conversations.assignedAnalystId, guard.assignedAnalystId));
  const [row] = await db
    .update(conversations)
    .set(patch)
    .where(and(...conditions))
    .returning();
  return row ? toConversation(row) : null;
}

/** Soma 1 ao contador de mensagens ao agent (só em `com_agent`). */
export async function incrementAgentMessageCount(db: AppDb, id: string, at: string): Promise<Conversation | null> {
  const [row] = await db
    .update(conversations)
    .set({ agentMessageCount: sql`${conversations.agentMessageCount} + 1`, updatedAt: at })
    .where(and(eq(conversations.id, id), eq(conversations.state, "com_agent")))
    .returning();
  return row ? toConversation(row) : null;
}

/** Acrescenta chamados relacionados à conversa e opcionalmente muda o chamado em foco. */
export async function relateTickets(
  db: AppDb,
  conversation: Conversation,
  numbers: string[],
  options: { focus?: string; at: string },
): Promise<Conversation> {
  const related = [...new Set([...conversation.relatedTickets, ...numbers.map((n) => n.toUpperCase())])];
  const updated = await updateConversation(db, conversation.id, {
    relatedTickets: related,
    focusTicket: options.focus?.toUpperCase() ?? conversation.focusTicket,
    updatedAt: options.at,
  });
  return updated ?? conversation;
}
