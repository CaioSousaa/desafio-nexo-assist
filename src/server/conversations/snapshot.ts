import { and, eq } from "drizzle-orm";
import { findUserById, listUsers, publicUser, type User } from "../auth/users";
import type { AppContext } from "../context";
import { conversationReads } from "../db/schema";
import { findDecisionsByMessageIds, type Decision } from "../decisions/repo";
import { listDrafts, type Draft } from "../drafts/repo";
import { channels } from "../events/bus";
import { HttpError } from "../http/respond";
import { listMessagesFor, type Message } from "../messages/repo";
import { isOpenStatus } from "../rules/catalog";
import { isOverdue, slaInfo } from "../rules/sla";
import { TicketServiceUnavailableError, type Ticket, type TicketEvent } from "../tickets";
import { findConversation, listEmployeeConversations, type Conversation } from "./repo";
import { contactTargetAt } from "./transfer";

export interface MessageAuthor {
  name: string;
  level: string | null;
}

export interface MessageView extends Message {
  decision: Decision | null;
  author: MessageAuthor | null;
}

export interface ConversationView {
  id: string;
  state: Conversation["state"];
  outcome: Conversation["outcome"];
  createdAt: string;
  closedAt: string | null;
  limitReached: boolean;
  pendingTransfer: boolean;
  agentMessageCount: number;
  inheritedSummary: string | null;
  previousConversationId: string | null;
  focusTicket: string | null;
  assignedAnalyst: { id: string; name: string; level: string | null } | null;
}

export interface ConversationBundle {
  conversation: ConversationView;
  messages: MessageView[];
  drafts: Draft[];
}

function toView(conversation: Conversation, users: Map<string, User>): ConversationView {
  const analyst = conversation.assignedAnalystId ? users.get(conversation.assignedAnalystId) : undefined;
  return {
    id: conversation.id,
    state: conversation.state,
    outcome: conversation.outcome,
    createdAt: conversation.createdAt,
    closedAt: conversation.closedAt,
    limitReached: conversation.limitReached,
    pendingTransfer: conversation.pendingTransfer,
    agentMessageCount: conversation.agentMessageCount,
    inheritedSummary: conversation.inheritedSummary,
    previousConversationId: conversation.previousConversationId,
    focusTicket: conversation.focusTicket,
    assignedAnalyst: analyst ? { id: analyst.id, name: analyst.name, level: analyst.analystLevel } : null,
  };
}

async function bundles(ctx: AppContext, conversations: Conversation[]): Promise<ConversationBundle[]> {
  const users = new Map((await listUsers(ctx.db)).map((u) => [u.id, u]));
  const ids = conversations.map((c) => c.id);
  const messagesByConversation = await listMessagesFor(ctx.db, ids);
  const allMessages = [...messagesByConversation.values()].flat();
  const decisions = await findDecisionsByMessageIds(ctx.db, allMessages.map((m) => m.id));
  const drafts = await listDrafts(ctx.db, ids);
  return conversations.map((conversation) => ({
    conversation: toView(conversation, users),
    messages: (messagesByConversation.get(conversation.id) ?? []).map((message) => {
      const user = message.authorId ? users.get(message.authorId) : undefined;
      return {
        ...message,
        decision: decisions.get(message.id) ?? null,
        author: user ? { name: user.name, level: user.analystLevel } : null,
      };
    }),
    drafts: drafts.filter((d) => d.conversationId === conversation.id),
  }));
}

export interface ChatSnapshot {
  conversations: ConversationBundle[];
  currentId: string | null;
  counter: { used: number; limit: number };
  state: Conversation["state"] | null;
  analystName: string | null;
  lastEventId: number;
}

/** Snapshot do chat (GET /api/chat): conversas do funcionário, mais antiga primeiro (FR-028, FR-080). */
export async function chatSnapshot(ctx: AppContext, employee: User): Promise<ChatSnapshot> {
  const lastEventId = ctx.bus.lastId(channels.employee(employee.id));
  const conversations = await listEmployeeConversations(ctx.db, employee.id);
  const all = await bundles(ctx, conversations);
  const current = conversations.find((c) => c.state !== "encerrada") ?? null;
  const currentView = all.find((b) => b.conversation.id === current?.id)?.conversation ?? null;
  return {
    conversations: all,
    currentId: current?.id ?? null,
    counter: { used: current?.agentMessageCount ?? 0, limit: ctx.config.messageLimit },
    state: current?.state ?? null,
    analystName: currentView?.assignedAnalyst?.name ?? null,
    lastEventId,
  };
}

export interface TicketPanelItem {
  ticket: Ticket;
  overdue: boolean;
  deadlineAt: string;
  lastEvent: TicketEvent | null;
  events: TicketEvent[];
}

export type TicketPanel =
  | { ok: true; ofConversation: TicketPanelItem[]; others: TicketPanelItem[]; counts: { open: number; closed: number } }
  | { ok: false; error: "tickets_unavailable"; message: string };

async function ticketPanel(ctx: AppContext, employee: User, conversation: Conversation): Promise<TicketPanel> {
  const now = ctx.now();
  try {
    const all = await ctx.tickets.listByRequester(employee.email);
    const related = new Set(conversation.relatedTickets);
    const item = async (ticket: Ticket, withEvents: boolean): Promise<TicketPanelItem> => {
      const events = withEvents ? ((await ctx.tickets.getWithEvents(ticket.number, {}))?.events ?? []) : [];
      return { ticket, overdue: isOverdue(ticket, now), deadlineAt: slaInfo(ticket, now).deadlineAt, lastEvent: events.at(-1) ?? null, events };
    };
    const ofConversation = await Promise.all(all.filter((t) => related.has(t.number)).map((t) => item(t, true)));
    const others = await Promise.all(all.filter((t) => !related.has(t.number)).map((t) => item(t, false)));
    return {
      ok: true,
      ofConversation,
      others,
      counts: { open: all.filter((t) => isOpenStatus(t.status)).length, closed: all.filter((t) => !isOpenStatus(t.status)).length },
    };
  } catch (error) {
    if (error instanceof TicketServiceUnavailableError) {
      return { ok: false, error: "tickets_unavailable", message: "Serviço de chamados indisponível" };
    }
    throw error;
  }
}

export interface ConsoleConversationSnapshot extends ConversationBundle {
  employee: ReturnType<typeof publicUser>;
  transfer: {
    reason: Conversation["transferReason"];
    confidence: number | null;
    summary: Conversation["transferSummary"];
    transferredAt: string | null;
    contactTargetAt: string | null;
    late: boolean;
  };
  previous: { id: string; outcome: Conversation["outcome"]; closedAt: string | null } | null;
  tickets: TicketPanel;
  lastEventId: number;
}

/** Snapshot de uma conversa no console (GET /api/console/conversations/:id); marca como lida. */
export async function consoleSnapshot(ctx: AppContext, analyst: User, conversationId: string): Promise<ConsoleConversationSnapshot> {
  const lastEventId = ctx.bus.lastId(channels.conversation(conversationId));
  const conversation = await findConversation(ctx.db, conversationId);
  if (!conversation) throw new HttpError(404, "not_found", "Conversa não encontrada.");
  const employee = await findUserById(ctx.db, conversation.employeeId);
  if (!employee) throw new HttpError(404, "not_found", "Funcionário não encontrado.");
  const [bundle] = await bundles(ctx, [conversation]);
  if (!bundle) throw new HttpError(404, "not_found", "Conversa não encontrada.");
  const previous = conversation.previousConversationId ? await findConversation(ctx.db, conversation.previousConversationId) : null;
  const now = ctx.now();
  const target = conversation.transferredAt ? contactTargetAt(new Date(conversation.transferredAt)) : null;
  await markRead(ctx, conversationId, analyst.id);
  return {
    ...bundle,
    employee: publicUser(employee),
    transfer: {
      reason: conversation.transferReason,
      confidence: conversation.transferConfidence,
      summary: conversation.transferSummary,
      transferredAt: conversation.transferredAt,
      contactTargetAt: target?.toISOString() ?? null,
      late: conversation.state === "aguardando_atendente" && target !== null && now > target,
    },
    previous: previous ? { id: previous.id, outcome: previous.outcome, closedAt: previous.closedAt } : null,
    tickets: await ticketPanel(ctx, employee, conversation),
    lastEventId,
  };
}

export async function markRead(ctx: AppContext, conversationId: string, analystId: string): Promise<void> {
  const at = ctx.now().toISOString();
  await ctx.db
    .insert(conversationReads)
    .values({ conversationId, analystId, lastReadAt: at })
    .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.analystId], set: { lastReadAt: at } });
}

export async function lastReadAt(ctx: AppContext, conversationId: string, analystId: string): Promise<string | null> {
  const [row] = await ctx.db
    .select()
    .from(conversationReads)
    .where(and(eq(conversationReads.conversationId, conversationId), eq(conversationReads.analystId, analystId)));
  return row?.lastReadAt ?? null;
}
