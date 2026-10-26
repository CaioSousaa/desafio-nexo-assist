import { closeAsResolved } from "../conversations/service";
import { findConversation, updateConversation, type Conversation } from "../conversations/repo";
import type { TransferInput } from "../conversations/transfer";
import type { AppContext } from "../context";
import { findPendingDraft, transitionDraft } from "../drafts/repo";
import { applyLimitIfReached } from "../conversations/limit";
import { logger } from "../logger";
import type { TurnScratch } from "./tools/context";

export interface PostActionDeps {
  transfer: (ctx: AppContext, conversationId: string, input: TransferInput) => Promise<Conversation | null>;
}

export type PostActionOutcome =
  | "skipped_not_with_agent"
  | "closed_resolved"
  | "transferred_low_confidence"
  | "transferred"
  | "transfer_pending_draft"
  | "limit_reached"
  | "none";

/**
 * Pós-ações do turno, nesta ordem (tech spec § Agent, passo 8): encerrar como resolvida → transferência por
 * confiança abaixo do limiar → transferência pedida (imediata ou agendada no crítico com rascunho) → limite.
 * Relê o estado antes: se um analista assumiu durante a resposta, nada acontece (achado 3 de tasks.md).
 */
export async function runPostActions(
  ctx: AppContext,
  input: { conversationId: string; scratch: TurnScratch; confidence: number },
  deps: PostActionDeps,
): Promise<PostActionOutcome[]> {
  const outcomes: PostActionOutcome[] = [];
  const conversation = await findConversation(ctx.db, input.conversationId);
  if (!conversation || conversation.state !== "com_agent") {
    logger.info("post_actions_skipped", { conversationId: input.conversationId, state: conversation?.state ?? null });
    return ["skipped_not_with_agent"];
  }

  if (input.scratch.closeRequested && !input.scratch.transferRequest) {
    const closed = await closeAsResolved(ctx, conversation.id);
    if (closed) return ["closed_resolved"];
  }

  if (input.confidence < ctx.config.confidenceThreshold) {
    const transferred = await deps.transfer(ctx, conversation.id, {
      reason: "baixa_confianca",
      confidence: input.confidence,
      summary: input.scratch.transferRequest?.summary ?? null,
    });
    if (transferred) return ["transferred_low_confidence"];
  }

  const request = input.scratch.transferRequest;
  if (request) {
    const pending = await findPendingDraft(ctx.db, conversation.id);
    if (pending && request.reason === "critico") {
      // D5: crítico com rascunho → transfere logo após Confirmar ou Cancelar.
      await transitionDraft(ctx.db, pending.id, ["aguardando_confirmacao"], { transferAfterDecision: true });
      await updateConversation(ctx.db, conversation.id, {
        pendingTransfer: true,
        transferReason: "critico",
        transferSummary: { ...request.summary, reason: "critico" },
        updatedAt: ctx.now().toISOString(),
      });
      outcomes.push("transfer_pending_draft");
    } else {
      const transferred = await deps.transfer(ctx, conversation.id, { reason: request.reason, summary: request.summary });
      if (transferred) return [...outcomes, "transferred"];
    }
  }

  const limited = await applyLimitIfReached(ctx, conversation.id);
  if (limited) outcomes.push("limit_reached");
  return outcomes.length ? outcomes : ["none"];
}
