import { TRANSFER_REASON_LABELS } from "@/lib/labels";
import { templates, postAgentTemplate } from "../agent/templates";
import type { AppContext } from "../context";
import { findPendingDraft } from "../drafts/repo";
import { logger } from "../logger";
import { listMessages, type CaseSummary } from "../messages/repo";
import { addBusinessHours } from "../rules/business-hours";
import { findConversation, relateTickets, updateConversation, type Conversation, type TransferReason } from "./repo";
import { appendSystemEvent, publishState } from "./service";

export const CONTACT_TARGET_BUSINESS_HOURS = 2;

export interface TransferInput {
  reason: TransferReason;
  summary?: CaseSummary | null;
  confidence?: number | null;
  /** Crítico cancelado: o funcionário não confirmou o chamado. */
  notConfirmed?: boolean;
  /** Chamado criado na mesma operação (crítico confirmado). */
  ticketNumber?: string | null;
}

/** Horário-alvo do primeiro contato humano (2 h úteis após a transferência; informativo). */
export function contactTargetAt(transferredAt: Date): Date {
  return addBusinessHours(transferredAt, CONTACT_TARGET_BUSINESS_HOURS);
}

/**
 * Transfere a conversa para a fila do service desk (FR-041): estado "aguardando atendente", resumo,
 * evento de sistema, aviso ao funcionário e evento no chamado em foco. Só sai de `com_agent`;
 * em qualquer outro estado não faz nada e devolve null.
 */
export async function transferConversation(
  ctx: AppContext,
  conversationId: string,
  input: TransferInput,
): Promise<Conversation | null> {
  const current = await findConversation(ctx.db, conversationId);
  if (!current || current.state !== "com_agent") return null;

  const tickets = [...new Set([...current.relatedTickets, ...(input.ticketNumber ? [input.ticketNumber] : [])])];
  const summary =
    input.summary ??
    (await ctx.summarizer.forTransfer({
      messages: await listMessages(ctx.db, conversationId),
      tickets,
      pendingDraft: await findPendingDraft(ctx.db, conversationId),
      reason: TRANSFER_REASON_LABELS[input.reason],
    }));
  const summaryTickets = [...new Set([...summary.tickets.map((t) => t.toUpperCase()), ...tickets])];
  const at = ctx.now();

  const transferred = await updateConversation(
    ctx.db,
    conversationId,
    {
      state: "aguardando_atendente",
      transferReason: input.reason,
      transferConfidence: input.confidence ?? null,
      transferSummary: {
        ...summary,
        tickets: summaryTickets,
        reason: input.reason,
        ...(input.notConfirmed ? { notConfirmed: true } : {}),
      },
      transferredAt: at.toISOString(),
      pendingTransfer: false,
      updatedAt: at.toISOString(),
    },
    { states: ["com_agent"] },
  );
  if (!transferred) return null;

  const focus = input.ticketNumber ?? transferred.focusTicket ?? summaryTickets[0] ?? null;
  const conversation = await relateTickets(ctx.db, transferred, summaryTickets, {
    ...(focus ? { focus } : {}),
    at: at.toISOString(),
  });

  await appendSystemEvent(ctx, conversation, "transferida");
  await postAgentTemplate(ctx, conversation, templates.transferNotice(contactTargetAt(at), at, TRANSFER_REASON_LABELS[input.reason] ?? input.reason));

  if (focus) {
    try {
      await ctx.tickets.registerTransfer(focus, { conversationId, reason: input.reason, author: "Nexo Assist" });
    } catch (error) {
      logger.warn("transfer_ticket_event_failed", { conversationId, ticket: focus, error });
    }
  }

  publishState(ctx, conversation);
  logger.info("transfer", { conversationId, reason: input.reason, confidence: input.confidence ?? null, ticket: focus });
  return conversation;
}
