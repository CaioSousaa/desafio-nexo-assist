import { HttpError } from "../http/respond";
import { postAgentTemplate, templates } from "../agent/templates";
import type { AppContext } from "../context";
import { findConversation, relateTickets, updateConversation, type Conversation } from "../conversations/repo";
import { notifyConsole, publishToConversation } from "../conversations/publish";
import { transferConversation } from "../conversations/transfer";
import { logger } from "../logger";
import type { Message } from "../messages/repo";
import { deadlineFor } from "../rules/sla";
import { TicketServiceUnavailableError, VIA_NEXO_ASSIST, type Ticket } from "../tickets";
import {
  findDraft,
  findPendingDraft,
  insertDraft,
  transitionDraft,
  type Draft,
  type DraftKind,
  type DraftPayload,
} from "./repo";

export const TICKETS_UNAVAILABLE_MESSAGE = "O sistema de chamados está instável, tente em instantes.";

function publishDraft(ctx: AppContext, conversation: { id: string; employeeId: string }, draft: Draft): void {
  publishToConversation(ctx, conversation, "draft", { draft });
}

/**
 * Propõe um rascunho (FR-016). O pendente anterior, se houver, vira "substituído" (FR-025).
 * Nada é gravado no serviço de chamados aqui.
 */
export async function proposeDraft(
  ctx: AppContext,
  conversation: Conversation,
  input: { kind: DraftKind; payload: DraftPayload },
): Promise<{ draft: Draft; replaced: Draft | null }> {
  const at = ctx.now().toISOString();
  for (let attempt = 0; ; attempt++) {
    const pending = await findPendingDraft(ctx.db, conversation.id);
    const replaced = pending
      ? await transitionDraft(ctx.db, pending.id, ["aguardando_confirmacao"], { status: "substituido", decidedAt: at })
      : null;
    try {
      const draft = await insertDraft(ctx.db, {
        conversationId: conversation.id,
        kind: input.kind,
        payload: input.payload,
        transferAfterDecision: pending?.transferAfterDecision ?? false,
        createdAt: at,
      });
      if (replaced) publishDraft(ctx, conversation, replaced);
      publishDraft(ctx, conversation, draft);
      return { draft, replaced };
    } catch (error) {
      if (attempt < 2) continue; // outro rascunho entrou no meio; substitui e tenta de novo
      throw error;
    }
  }
}

async function loadOwnedDraft(ctx: AppContext, draftId: string, employeeId: string): Promise<{ draft: Draft; conversation: Conversation }> {
  const draft = await findDraft(ctx.db, draftId);
  const conversation = draft ? await findConversation(ctx.db, draft.conversationId) : null;
  if (!draft || !conversation || conversation.employeeId !== employeeId) {
    throw new HttpError(404, "not_found", "Rascunho não encontrado.");
  }
  return { draft, conversation };
}

async function execute(ctx: AppContext, draft: Draft, employeeEmail: string): Promise<{ ticket: Ticket; attempts: number }> {
  const key = draft.id;
  const { payload } = draft;
  switch (draft.kind) {
    case "novo": {
      const result = await ctx.tickets.attempt((s) =>
        s.create(
          {
            kind: payload.type,
            title: payload.title,
            description: payload.description,
            category: payload.category,
            priority: payload.priority,
            affected: payload.affected,
            requesterEmail: employeeEmail,
          },
          { idempotencyKey: key },
        ),
      );
      return { ticket: result.value, attempts: result.attempts };
    }
    case "atualizacao": {
      const target = payload.targetTicket;
      if (!target) throw new HttpError(422, "invalid_draft", "Rascunho de atualização sem chamado alvo.");
      const result = await ctx.tickets.attempt((s) =>
        s.addNote(
          target,
          { text: payload.note ?? payload.description, author: VIA_NEXO_ASSIST, ...(payload.newPriority ? { newPriority: payload.newPriority } : {}) },
          { idempotencyKey: key },
        ),
      );
      return { ticket: result.value, attempts: result.attempts };
    }
    case "reabertura": {
      const target = payload.targetTicket;
      if (!target) throw new HttpError(422, "invalid_draft", "Rascunho de reabertura sem chamado alvo.");
      const result = await ctx.tickets.attempt((s) =>
        s.reopen(target, { text: payload.note ?? payload.description, author: VIA_NEXO_ASSIST }, { idempotencyKey: key }),
      );
      return { ticket: result.value, attempts: result.attempts };
    }
  }
}

export interface DraftDecisionResult {
  draft: Draft;
  ticket?: Ticket;
  message: Message;
  conversation: Conversation;
}

/**
 * "Confirmar" (FR-016, FR-026, FR-044, SC-002): grava no serviço de chamados com até 3 novas tentativas,
 * idempotente pela chave = id do rascunho. Repetir ou clicar duas vezes nunca cria duplicado.
 */
export async function confirmDraft(
  ctx: AppContext,
  draftId: string,
  employee: { id: string; email: string },
): Promise<DraftDecisionResult> {
  const { draft, conversation } = await loadOwnedDraft(ctx, draftId, employee.id);
  if (draft.status !== "aguardando_confirmacao") throw new HttpError(409, "not_pending", "Este rascunho já foi decidido.");

  let executed: { ticket: Ticket; attempts: number };
  try {
    executed = await execute(ctx, draft, employee.email);
  } catch (error) {
    if (error instanceof TicketServiceUnavailableError) {
      const kept = await transitionDraft(ctx.db, draft.id, ["aguardando_confirmacao"], { lastError: TICKETS_UNAVAILABLE_MESSAGE });
      if (kept) publishDraft(ctx, conversation, kept);
      logger.warn("confirm_failed", { draftId, attempts: error.attempts });
      throw new HttpError(503, "tickets_unavailable", TICKETS_UNAVAILABLE_MESSAGE, { attempts: error.attempts });
    }
    throw error;
  }

  const at = ctx.now();
  const confirmed = await transitionDraft(ctx.db, draft.id, ["aguardando_confirmacao"], {
    status: "confirmado",
    resultingTicket: executed.ticket.number,
    lastError: null,
    decidedAt: at.toISOString(),
  });
  // Outro clique venceu a corrida: o serviço devolveu o mesmo chamado (idempotência) e quem venceu responde.
  if (!confirmed) throw new HttpError(409, "not_pending", "Este rascunho já foi decidido.");
  publishDraft(ctx, conversation, confirmed);

  const related = await relateTickets(ctx.db, conversation, [executed.ticket.number], { focus: executed.ticket.number, at: at.toISOString() });
  const spec =
    draft.kind === "novo"
      ? templates.ticketCreated(executed.ticket, deadlineFor(executed.ticket.priority, new Date(executed.ticket.createdAt)), at, executed.attempts)
      : draft.kind === "atualizacao"
        ? templates.ticketUpdated(executed.ticket, executed.attempts, Boolean(draft.payload.newPriority))
        : templates.ticketReopened(executed.ticket, executed.attempts);
  const { message } = await postAgentTemplate(ctx, related, spec);

  let finalConversation = related;
  if (confirmed.transferAfterDecision) {
    finalConversation = (await transferPending(ctx, related, { ticketNumber: executed.ticket.number })) ?? related;
  }
  notifyConsole(ctx, conversation.id);
  return { draft: confirmed, ticket: executed.ticket, message, conversation: finalConversation };
}

/** "Cancelar" (FR-024): descarta sem gravar. Crítico pendente transfere mesmo assim (D5, FR-044). */
export async function cancelDraft(
  ctx: AppContext,
  draftId: string,
  employee: { id: string },
): Promise<DraftDecisionResult> {
  const { draft, conversation } = await loadOwnedDraft(ctx, draftId, employee.id);
  const at = ctx.now().toISOString();
  const cancelled = await transitionDraft(ctx.db, draft.id, ["aguardando_confirmacao"], { status: "cancelado", decidedAt: at });
  if (!cancelled) throw new HttpError(409, "not_pending", "Este rascunho já foi decidido.");
  publishDraft(ctx, conversation, cancelled);
  const { message } = await postAgentTemplate(ctx, conversation, templates.draftCancelled(draft.displayCode, cancelled.transferAfterDecision));
  let finalConversation = conversation;
  if (cancelled.transferAfterDecision) {
    finalConversation = (await transferPending(ctx, conversation, { notConfirmed: true })) ?? conversation;
  }
  return { draft: cancelled, message, conversation: finalConversation };
}

/** Executa a transferência agendada pelo caso crítico, usando o resumo guardado na conversa. */
async function transferPending(
  ctx: AppContext,
  conversation: Conversation,
  extra: { ticketNumber?: string; notConfirmed?: boolean },
): Promise<Conversation | null> {
  const fresh = (await findConversation(ctx.db, conversation.id)) ?? conversation;
  const stored = fresh.transferSummary;
  const summary = stored
    ? {
        problem: stored.problem,
        done: extra.notConfirmed
          ? `${stored.done} O funcionário não confirmou o chamado.`.trim()
          : `${stored.done} Chamado ${extra.ticketNumber} criado após confirmação.`.trim(),
        tickets: [...new Set([...stored.tickets, ...(extra.ticketNumber ? [extra.ticketNumber] : [])])],
        priority: stored.priority ?? null,
      }
    : null;
  const transferred = await transferConversation(ctx, conversation.id, {
    reason: fresh.transferReason ?? "critico",
    summary,
    ...(extra.ticketNumber ? { ticketNumber: extra.ticketNumber } : {}),
    ...(extra.notConfirmed ? { notConfirmed: true } : {}),
  });
  if (!transferred) {
    await updateConversation(ctx.db, conversation.id, { pendingTransfer: false });
  }
  return transferred;
}

/** Ao continuar em nova conversa, o rascunho pendente expira (citado no resumo). */
export async function expirePendingDraft(ctx: AppContext, conversation: Conversation): Promise<Draft | null> {
  const pending = await findPendingDraft(ctx.db, conversation.id);
  if (!pending) return null;
  const expired = await transitionDraft(ctx.db, pending.id, ["aguardando_confirmacao"], {
    status: "expirado",
    decidedAt: ctx.now().toISOString(),
  });
  if (expired) publishDraft(ctx, conversation, expired);
  return expired;
}
