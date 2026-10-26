import { formatTime } from "@/lib/format";
import { OUTCOME_LABELS } from "@/lib/labels";
import type { AppContext } from "../context";
import { findPendingDraft } from "../drafts/repo";
import { logger } from "../logger";
import { insertMessage, type Message, type MessageParts, type SystemEventType } from "../messages/repo";
import {
  findConversation,
  findOpenConversation,
  insertConversation,
  updateConversation,
  type Conversation,
} from "./repo";
import { notifyConsole, publishToConversation } from "./publish";

/** Conversa não encerrada do funcionário, ou uma nova (FR-029: a próxima mensagem após encerrar abre outra). */
export async function getOrOpenConversation(
  ctx: AppContext,
  employeeId: string,
): Promise<{ conversation: Conversation; opened: boolean }> {
  const open = await findOpenConversation(ctx.db, employeeId);
  if (open) return { conversation: open, opened: false };
  try {
    const conversation = await insertConversation(ctx.db, { employeeId, createdAt: ctx.now().toISOString() });
    publishToConversation(ctx, conversation, "conversation", { state: conversation.state });
    notifyConsole(ctx, conversation.id);
    return { conversation, opened: true };
  } catch (error) {
    // Duas abas abrindo ao mesmo tempo: o índice único deixa só uma passar.
    const winner = await findOpenConversation(ctx.db, employeeId);
    if (winner) return { conversation: winner, opened: false };
    throw error;
  }
}

export function systemEventText(type: SystemEventType, at: Date, extra: { actor?: string; outcome?: string; limit?: number } = {}): string {
  const time = formatTime(at);
  switch (type) {
    case "transferida":
      return `Transferida para o service desk · ${time}`;
    case "assumida":
      return `${extra.actor ?? "Analista"} assumiu · agent pausado · ${time}`;
    case "devolvida":
      return `Nexo Assist voltou · ${time}`;
    case "encerrada":
      return extra.outcome ? `Atendimento encerrado · ${extra.outcome} · ${time}` : `Atendimento encerrado · ${time}`;
    case "resolvida":
      return `${OUTCOME_LABELS.resolvida_pelo_agent} · ${time}`;
    case "limite":
      return `Limite de ${extra.limit ?? 30} mensagens atingido · ${time}`;
    case "continuada":
      return `Continuação da conversa anterior · ${time}`;
  }
}

export async function appendSystemEvent(
  ctx: AppContext,
  conversation: Conversation,
  eventType: SystemEventType,
  options: { actor?: string; outcome?: string; parts?: MessageParts; text?: string } = {},
): Promise<Message> {
  const at = ctx.now();
  const { message } = await insertMessage(ctx.db, {
    conversationId: conversation.id,
    authorType: "sistema",
    text: options.text ?? systemEventText(eventType, at, { ...options, limit: ctx.config.messageLimit }),
    eventType,
    ...(options.parts ? { parts: options.parts } : {}),
    createdAt: at.toISOString(),
  });
  publishToConversation(ctx, conversation, "message", { message });
  return message;
}

export function publishState(ctx: AppContext, conversation: Conversation, analystName?: string | null): void {
  publishToConversation(ctx, conversation, "state", {
    state: conversation.state,
    outcome: conversation.outcome,
    assignedAnalystId: conversation.assignedAnalystId,
    analystName: analystName ?? null,
    limitReached: conversation.limitReached,
    pendingTransfer: conversation.pendingTransfer,
  });
  notifyConsole(ctx, conversation.id);
}

/**
 * Encerra como "Resolvida pelo agent" (FR-029). Só com o agent atendendo, sem rascunho pendente e sem
 * transferência agendada; caso contrário devolve null e o agent deve perguntar antes.
 */
export async function closeAsResolved(ctx: AppContext, conversationId: string): Promise<Conversation | null> {
  const conversation = await findConversation(ctx.db, conversationId);
  if (!conversation || conversation.state !== "com_agent" || conversation.pendingTransfer) return null;
  if (await findPendingDraft(ctx.db, conversationId)) return null;
  const at = ctx.now().toISOString();
  const closed = await updateConversation(
    ctx.db,
    conversationId,
    { state: "encerrada", outcome: "resolvida_pelo_agent", closedAt: at, updatedAt: at },
    { states: ["com_agent"] },
  );
  if (!closed) return null;
  await appendSystemEvent(ctx, closed, "resolvida");
  publishState(ctx, closed);
  logger.info("conversation_closed", { conversationId, outcome: "resolvida_pelo_agent" });
  return closed;
}
