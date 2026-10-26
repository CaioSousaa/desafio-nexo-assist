import { postAgentTemplate, templates } from "../agent/templates";
import type { AppContext } from "../context";
import { expirePendingDraft } from "../drafts/service";
import { HttpError } from "../http/respond";
import { logger } from "../logger";
import { listMessages, type CaseSummary } from "../messages/repo";
import { findConversation, findOpenConversation, insertConversation, updateConversation, type Conversation } from "./repo";
import { notifyConsole, publishToConversation } from "./publish";
import { appendSystemEvent, publishState } from "./service";
import { transferConversation } from "./transfer";

/** Contam no limite as mensagens do funcionário ao agent (texto, opção rápida, seleção); nada mais (FR-070). */
export function countsTowardLimit(conversation: Conversation, limit: number): boolean {
  return conversation.state === "com_agent" && !conversation.limitReached && conversation.agentMessageCount < limit;
}

/**
 * Se o contador chegou ao limite, envia a mensagem de limite com as opções e bloqueia o agent (FR-071).
 * Devolve a conversa atualizada, ou null se nada mudou.
 */
export async function applyLimitIfReached(ctx: AppContext, conversationId: string): Promise<Conversation | null> {
  const conversation = await findConversation(ctx.db, conversationId);
  const limit = ctx.config.messageLimit;
  if (!conversation || conversation.state !== "com_agent" || conversation.limitReached) return null;
  if (conversation.agentMessageCount < limit) return null;
  const updated = await updateConversation(
    ctx.db,
    conversationId,
    { limitReached: true, updatedAt: ctx.now().toISOString() },
    { states: ["com_agent"] },
  );
  if (!updated || !updated.limitReached) return null;
  await appendSystemEvent(ctx, updated, "limite");
  await postAgentTemplate(ctx, updated, templates.limitReached(limit));
  publishState(ctx, updated);
  logger.info("limit_reached", { conversationId, limit });
  return updated;
}

function summaryText(summary: CaseSummary): string {
  return [
    `Problema: ${summary.problem}`,
    summary.done ? `Feito: ${summary.done}` : "",
    summary.tickets.length ? `Chamados: ${summary.tickets.join(", ")}` : "",
    summary.priority ? `Prioridade: ${summary.priority}` : "",
    summary.pendingDraft ? `Rascunho ${summary.pendingDraft} expirou sem decisão` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * "Continuar em nova conversa" (FR-072): encerra a atual como "limite atingido", expira o rascunho pendente,
 * gera o resumo e abre outra conversa com contador zerado, resumo herdado e abertura do agent.
 */
export async function continueInNewConversation(ctx: AppContext, employeeId: string): Promise<Conversation> {
  const current = await findOpenConversation(ctx.db, employeeId);
  if (!current || !current.limitReached || current.state !== "com_agent") {
    throw new HttpError(409, "limit_not_reached", "O limite de mensagens desta conversa ainda não foi atingido.");
  }
  const expired = await expirePendingDraft(ctx, current);
  const summary = await ctx.summarizer.forContinuation({
    messages: await listMessages(ctx.db, current.id),
    tickets: current.relatedTickets,
    pendingDraft: expired,
  });
  const fullSummary: CaseSummary = { ...summary, pendingDraft: expired?.displayCode ?? summary.pendingDraft ?? null };

  const at = ctx.now().toISOString();
  const closed = await updateConversation(
    ctx.db,
    current.id,
    { state: "encerrada", outcome: "limite_atingido", closedAt: at, updatedAt: at },
    { states: ["com_agent"] },
  );
  if (!closed) throw new HttpError(409, "conflict", "A conversa mudou de estado; recarregue.");
  await appendSystemEvent(ctx, closed, "encerrada", { outcome: "limite de mensagens" });
  publishState(ctx, closed);

  const next = await insertConversation(ctx.db, {
    employeeId,
    createdAt: ctx.now().toISOString(),
    inheritedSummary: summaryText(fullSummary),
    previousConversationId: closed.id,
  });
  const related = closed.relatedTickets.length
    ? ((await updateConversation(ctx.db, next.id, { relatedTickets: closed.relatedTickets, focusTicket: closed.focusTicket })) ?? next)
    : next;
  publishToConversation(ctx, related, "conversation", { state: related.state, previousConversationId: closed.id });
  await appendSystemEvent(ctx, related, "continuada", { parts: { summary: fullSummary } });
  await postAgentTemplate(ctx, related, templates.continuationOpening(fullSummary));
  notifyConsole(ctx, related.id);
  logger.info("conversation_continued", { from: closed.id, to: related.id });
  return related;
}

/** "Falar com um analista" no limite: transfere normalmente (FR-071, US11 cenário 4). */
export async function transferAtLimit(ctx: AppContext, employeeId: string): Promise<Conversation> {
  const current = await findOpenConversation(ctx.db, employeeId);
  if (!current || current.state !== "com_agent") {
    throw new HttpError(409, "not_with_agent", "A conversa não está com o agent.");
  }
  const transferred = await transferConversation(ctx, current.id, { reason: current.limitReached ? "limite" : "pedido" });
  if (!transferred) throw new HttpError(409, "not_with_agent", "A conversa não está com o agent.");
  return transferred;
}
