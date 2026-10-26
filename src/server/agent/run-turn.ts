import { randomUUID } from "node:crypto";
import type { User } from "../auth/users";
import type { AppContext } from "../context";
import { findConversation, incrementAgentMessageCount, relateTickets, type Conversation } from "../conversations/repo";
import { notifyConsole, publishToConversation } from "../conversations/publish";
import { applyLimitIfReached, countsTowardLimit } from "../conversations/limit";
import { getOrOpenConversation } from "../conversations/service";
import { transferConversation } from "../conversations/transfer";
import { findDecisionsByMessageIds, insertDecision, type Decision, type DecisionStep } from "../decisions/repo";
import { findPendingDraft } from "../drafts/repo";
import { HttpError } from "../http/respond";
import { logger } from "../logger";
import { getMessage, insertMessage, listMessages, updateMessage, type Message, type MessageParts } from "../messages/repo";
import { buildHistory } from "./context";
import { runPostActions } from "./post-actions";
import { toDecisionUsage } from "./pricing";
import { consumeAgentStream, type LiveStep } from "./stream-consumer";
import { createRequestContext, createTurnScratch, type TurnScratch } from "./tools/context";
import { recordDecisionInput, type RecordDecisionInput } from "./tools/record-decision";

export const INTERRUPTED_TEXT = "A resposta foi interrompida. Tente de novo.";
export const MODEL_ERROR_TEXT = "Não consegui responder agora.";
export const FALLBACK_RATIONALE = "O agent não registrou a decisão; transferido por segurança.";

export class LimitReachedError extends HttpError {
  constructor() {
    super(409, "limit_reached", "Limite de mensagens desta conversa atingido. Escolha uma das opções acima.");
  }
}

export interface AcceptResult {
  conversation: Conversation;
  employeeMessage: Message;
  agentMessage: Message | null;
  duplicate: boolean;
  /** Executa o turno do agent (a rota não espera; a suíte de avaliação espera). */
  run: (() => Promise<void>) | null;
}

/**
 * Recebe a mensagem do funcionário (tech spec § Agent, passos 1–3): grava de forma idempotente, respeita o
 * estado (agent em silêncio com analista, FR-042) e o limite (FR-070/071) e prepara a resposta pendente.
 */
export async function acceptEmployeeMessage(
  ctx: AppContext,
  employee: User,
  input: { text: string; clientMessageId: string },
): Promise<AcceptResult> {
  const { conversation } = await getOrOpenConversation(ctx, employee.id);
  if (conversation.state === "com_agent" && conversation.limitReached) throw new LimitReachedError();

  const counts = countsTowardLimit(conversation, ctx.config.messageLimit);
  const { message: employeeMessage, duplicate } = await insertMessage(ctx.db, {
    conversationId: conversation.id,
    authorType: "funcionario",
    authorId: employee.id,
    text: input.text,
    clientMessageId: input.clientMessageId,
    countsTowardLimit: counts,
    createdAt: ctx.now().toISOString(),
  });
  if (duplicate) return { conversation, employeeMessage, agentMessage: null, duplicate: true, run: null };

  // Números citados pelo funcionário só entram na conversa depois que uma ferramenta confirma que são dele.
  const current = conversation;
  publishToConversation(ctx, current, "message", { message: employeeMessage });
  notifyConsole(ctx, current.id);

  if (current.state !== "com_agent") {
    return { conversation: current, employeeMessage, agentMessage: null, duplicate: false, run: null };
  }

  if (!counts) {
    // Voltou do analista já com o contador no limite: avisa em vez de chamar o modelo (achado 4).
    const limited = (await applyLimitIfReached(ctx, current.id)) ?? current;
    return { conversation: limited, employeeMessage, agentMessage: null, duplicate: false, run: null };
  }

  const counted = (await incrementAgentMessageCount(ctx.db, current.id, ctx.now().toISOString())) ?? current;
  const agentMessage = await createPendingAgentMessage(ctx, counted);
  return {
    conversation: counted,
    employeeMessage,
    agentMessage,
    duplicate: false,
    run: () => runAgentTurn(ctx, { conversationId: counted.id, agentMessageId: agentMessage.id, employee }),
  };
}

async function createPendingAgentMessage(ctx: AppContext, conversation: Conversation): Promise<Message> {
  const { message } = await insertMessage(ctx.db, {
    conversationId: conversation.id,
    authorType: "agent",
    status: "pending",
    createdAt: ctx.now().toISOString(),
  });
  publishToConversation(ctx, conversation, "message", { message });
  return message;
}

/** "Tentar de novo" (FR-027/FR-081): reexecuta o turno na mesma mensagem, sem contar de novo no limite. */
export async function retryAgentMessage(ctx: AppContext, employee: User, messageId: string): Promise<{ message: Message; run: () => Promise<void> }> {
  const message = await getMessage(ctx.db, messageId);
  const conversation = message ? await findConversation(ctx.db, message.conversationId) : null;
  if (!message || !conversation || conversation.employeeId !== employee.id || message.authorType !== "agent") {
    throw new HttpError(404, "not_found", "Mensagem não encontrada.");
  }
  if (message.status !== "error") throw new HttpError(409, "not_failed", "Esta resposta não falhou.");
  if (conversation.state !== "com_agent") throw new HttpError(409, "not_with_agent", "A conversa não está com o agent.");
  const pending = await updateMessage(ctx.db, message.id, { status: "pending", text: "", parts: {} });
  if (!pending) throw new HttpError(404, "not_found", "Mensagem não encontrada.");
  publishToConversation(ctx, conversation, "message", { message: pending });
  return { message: pending, run: () => runAgentTurn(ctx, { conversationId: conversation.id, agentMessageId: message.id, employee }) };
}

function partsFrom(scratch: TurnScratch): MessageParts {
  const parts: MessageParts = {};
  if (scratch.quickOptions?.length) parts.quick_options = scratch.quickOptions;
  if (scratch.ticketList?.length) parts.ticket_list = scratch.ticketList;
  if (scratch.ticketCard) parts.ticket_card = scratch.ticketCard;
  if (scratch.draftId) parts.draft_id = scratch.draftId;
  return parts;
}

function fallbackText(scratch: TurnScratch): string {
  if (scratch.draftId) return "Montei o rascunho abaixo. Confira e, se estiver certo, clique em Confirmar.";
  if (scratch.ticketList?.length) return "Encontrei estes chamados. Qual deles você quer ver?";
  if (scratch.ticketCard) return `Aqui está o ${scratch.ticketCard.number}.`;
  if (scratch.quickOptions?.length) return "Pode escolher uma das opções abaixo?";
  return "Certo.";
}

function toUnderstanding(input: RecordDecisionInput) {
  return {
    intent: input.understanding.intent,
    entities: Object.fromEntries((input.understanding.entities ?? []).map((e) => [e.name, e.value])),
    assumptions: input.understanding.assumptions ?? [],
  };
}

/** Última chamada válida a record_decision (duas chamadas: vale a última, com aviso no log). */
export function pickDecision(calls: Array<Record<string, unknown>>, log = logger): RecordDecisionInput | null {
  if (calls.length > 1) log.warn("decision_multiple", { count: calls.length });
  for (let i = calls.length - 1; i >= 0; i--) {
    const parsed = recordDecisionInput.safeParse(calls[i]);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/**
 * Turno do agent (passos 4–9): monta contexto, chama o modelo em streaming, publica passos e texto, grava a
 * decisão e aplica as pós-ações. Qualquer falha vira mensagem de erro com "Tentar de novo".
 */
export async function runAgentTurn(
  ctx: AppContext,
  input: { conversationId: string; agentMessageId: string; employee: User },
): Promise<void> {
  const log = logger.child({ conversationId: input.conversationId, messageId: input.agentMessageId });
  const startedAt = Date.now();
  const conversation = await findConversation(ctx.db, input.conversationId);
  if (!conversation) return;
  const publish = (type: Parameters<typeof publishToConversation>[2], data: Record<string, unknown>) =>
    publishToConversation(ctx, conversation, type, data);

  try {
    log.info("turn_started");
    const messages = await listMessages(ctx.db, conversation.id);
    const decisions = await findDecisionsByMessageIds(ctx.db, messages.map((m) => m.id));
    const history = buildHistory(messages, decisions, [input.agentMessageId]);
    const scratch = createTurnScratch();
    const pendingDraft = await findPendingDraft(ctx.db, conversation.id);
    const requestContext = createRequestContext({ app: ctx, employee: input.employee, conversation, pendingDraft, scratch });

    const output = await ctx.agent.stream(history, { requestContext });
    const result = await consumeAgentStream(output.fullStream, {
      step: (step: LiveStep) => {
        if (step.status === "done") log.info("tool_result", { tool: step.tool, ok: step.ok, durationMs: step.durationMs, attempts: step.attempts });
        else log.info("tool_call", { tool: step.tool });
        publish("step", { messageId: input.agentMessageId, step });
      },
      text: (delta) => publish("text_delta", { messageId: input.agentMessageId, delta }),
    });
    if (result.error) throw result.error;

    let picked = pickDecision(result.decisionCalls, log);
    let steps: DecisionStep[] = result.steps;
    if (!picked) {
      log.warn("decision_missing", { attempt: 1 });
      const before = scratch.decisions.length;
      try {
        await ctx.agent.recordDecisionOnly([...history, { role: "assistant", content: result.text || fallbackText(scratch) }], { requestContext });
      } catch (error) {
        log.warn("decision_retry_failed", { error });
      }
      picked = pickDecision(scratch.decisions.slice(before) as Array<Record<string, unknown>>, log);
      if (picked) {
        steps = [...steps, { id: randomUUID(), tool: "record_decision", labels: [], visible: false, inputSummary: `action=${picked.action} confidence=${picked.confidence}`, outputSummary: "registrada na segunda chamada", durationMs: 0, ok: true, error: null, attempts: 2 }];
      }
    }
    const source = picked ? "modelo" : "fallback";
    if (!picked) log.warn("decision_missing", { attempt: 2, fallback: true });

    const usage = toDecisionUsage(await output.usage.catch(() => undefined), ctx.agent.modelName);
    const decisionId = randomUUID();
    const decision: Decision = await insertDecision(ctx.db, {
      id: decisionId,
      conversationId: conversation.id,
      messageId: input.agentMessageId,
      understanding: picked ? toUnderstanding(picked) : { intent: "Não registrado", entities: {}, assumptions: [] },
      action: picked?.action ?? "transferir",
      confidence: picked?.confidence ?? 0,
      rationale: picked?.rationale ?? FALLBACK_RATIONALE,
      rules: picked?.rules ?? (picked ? [] : ["FR-032 · Confiança abaixo do limiar transfere para analista"]),
      steps,
      usage,
      model: ctx.agent.modelName,
      source,
      durationMs: Date.now() - startedAt,
      firstSignalMs: result.firstSignalMs,
      createdAt: ctx.now().toISOString(),
    });
    log.info("decision_recorded", { action: decision.action, confidence: decision.confidence, source });

    const text = result.text || fallbackText(scratch);
    if (!result.text) log.warn("empty_text");
    const finalMessage = await updateMessage(ctx.db, input.agentMessageId, {
      text,
      parts: partsFrom(scratch),
      decisionId,
      status: "done",
    });
    publish("message", { message: finalMessage, decision });
    publish("decision", { messageId: input.agentMessageId, decision });
    notifyConsole(ctx, conversation.id);

    const mentioned = [...scratch.mentionedTickets];
    if (mentioned.length || scratch.focusTicket) {
      const fresh = (await findConversation(ctx.db, conversation.id)) ?? conversation;
      await relateTickets(ctx.db, fresh, mentioned, { ...(scratch.focusTicket ? { focus: scratch.focusTicket } : {}), at: ctx.now().toISOString() });
    }

    const outcomes = await runPostActions(ctx, { conversationId: conversation.id, scratch, confidence: decision.confidence }, { transfer: transferConversation });
    log.info("turn_finished", { outcomes, durationMs: Date.now() - startedAt, firstSignalMs: result.firstSignalMs });
  } catch (error) {
    log.error("turn_failed", { error });
    const failed = await updateMessage(ctx.db, input.agentMessageId, {
      status: "error",
      text: MODEL_ERROR_TEXT,
      parts: { error_reason: error instanceof Error ? error.message.slice(0, 200) : "erro desconhecido" },
    });
    publish("message", { message: failed });
    publish("error", { messageId: input.agentMessageId, reason: MODEL_ERROR_TEXT });
  }
}
