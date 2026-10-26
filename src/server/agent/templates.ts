import { randomUUID } from "node:crypto";
import { formatDateTime, formatTime, dayKey } from "@/lib/format";
import type { AppContext } from "../context";
import type { Conversation } from "../conversations/repo";
import { publishToConversation, notifyConsole } from "../conversations/publish";
import { insertDecision, type Decision, type DecisionStep } from "../decisions/repo";
import { insertMessage, type CaseSummary, type Message, type MessageParts } from "../messages/repo";
import type { Ticket } from "../tickets";

// Mensagens do agent que não passam pelo modelo. Cada uma grava um registro de decisão (SC-004).

export interface TemplateStep {
  tool: string;
  labels: string[];
  inputSummary?: string;
  outputSummary?: string;
  attempts?: number;
  ok?: boolean;
  durationMs?: number;
  visible?: boolean;
}

export interface TemplateSpec {
  text: string;
  parts?: MessageParts;
  action: string;
  intent: string;
  rationale: string;
  rules: string[];
  steps: TemplateStep[];
  entities?: Record<string, string>;
}

export async function postAgentTemplate(
  ctx: AppContext,
  conversation: Conversation,
  spec: TemplateSpec,
): Promise<{ message: Message; decision: Decision }> {
  const at = ctx.now().toISOString();
  const decisionId = randomUUID();
  const { message } = await insertMessage(ctx.db, {
    conversationId: conversation.id,
    authorType: "agent",
    text: spec.text,
    ...(spec.parts ? { parts: spec.parts } : {}),
    decisionId,
    status: "done",
    createdAt: at,
  });
  const steps: DecisionStep[] = spec.steps.map((step) => ({
    id: randomUUID(),
    tool: step.tool,
    labels: step.labels,
    visible: step.visible ?? step.labels.length > 0,
    inputSummary: step.inputSummary ?? "",
    outputSummary: step.outputSummary ?? "",
    durationMs: step.durationMs ?? 0,
    ok: step.ok ?? true,
    error: null,
    attempts: step.attempts ?? 1,
  }));
  const decision = await insertDecision(ctx.db, {
    id: decisionId,
    conversationId: conversation.id,
    messageId: message.id,
    understanding: { intent: spec.intent, entities: spec.entities ?? {}, assumptions: [] },
    action: spec.action,
    confidence: 100,
    rationale: spec.rationale,
    rules: spec.rules,
    steps,
    source: "template",
    createdAt: at,
  });
  publishToConversation(ctx, conversation, "message", { message, decision });
  notifyConsole(ctx, conversation.id);
  return { message, decision };
}

const RULE_CONFIRM = "RN-003 · Chamado só é criado ou atualizado depois da confirmação do funcionário";
const RULE_TRANSFER = "RN-005 · Transferência leva resumo; o agent não responde enquanto a conversa está com analista";

function deadlineText(deadline: Date, now: Date): string {
  return dayKey(deadline) === dayKey(now) ? `até ${formatTime(deadline)}` : `até ${formatDateTime(deadline)}`;
}

export const templates = {
  ticketCreated(ticket: Ticket, deadline: Date, now: Date, attempts: number): TemplateSpec {
    return {
      text: `Pronto: abri o chamado ${ticket.number} com prioridade ${ticket.priority}. Primeira resposta ${deadlineText(deadline, now)}.`,
      action: "registrar_chamado",
      intent: "Funcionário confirmou o rascunho",
      entities: { chamado: ticket.number, prioridade: ticket.priority },
      rationale: "Você confirmou o rascunho, então gravei o chamado no serviço de chamados. O prazo é o da prioridade calculada pelas regras do service desk.",
      rules: [RULE_CONFIRM, "RN-008 · Prazo da primeira resposta conforme a prioridade"],
      steps: [{ tool: "tickets.create", labels: ["criou o chamado"], inputSummary: `${ticket.kind} · ${ticket.category} · ${ticket.priority}`, outputSummary: ticket.number, attempts }],
    };
  },

  ticketUpdated(ticket: Ticket, attempts: number, priorityChanged: boolean): TemplateSpec {
    return {
      text: `Atualizei o ${ticket.number} com a nova informação${priorityChanged ? ` e a prioridade passou para ${ticket.priority}` : ""}. O analista vê a nota no histórico do chamado.`,
      action: "registrar_chamado",
      intent: "Funcionário confirmou a atualização",
      entities: { chamado: ticket.number },
      rationale: "Já existia um chamado aberto sobre o mesmo problema; em vez de abrir outro, acrescentei a nota ao existente.",
      rules: [RULE_CONFIRM, "RN-004 · Sem duplicidade: chamado aberto sobre o mesmo problema é atualizado"],
      steps: [{ tool: "tickets.addNote", labels: ["atualizou o chamado"], inputSummary: ticket.number, outputSummary: `nota gravada${priorityChanged ? `; prioridade ${ticket.priority}` : ""}`, attempts }],
    };
  },

  ticketReopened(ticket: Ticket, attempts: number): TemplateSpec {
    return {
      text: `Reabri o ${ticket.number}. Ele volta para a fila com o histórico anterior, e o analista vê o que você contou.`,
      action: "registrar_chamado",
      intent: "Funcionário confirmou a reabertura",
      entities: { chamado: ticket.number },
      rationale: "O chamado tinha sido resolvido há até 7 dias e o problema voltou; reabrir mantém o histórico e evita duplicidade.",
      rules: [RULE_CONFIRM, "RN-004 · Resolvido há até 7 dias pode ser reaberto"],
      steps: [{ tool: "tickets.reopen", labels: ["reabriu o chamado"], inputSummary: ticket.number, outputSummary: "status aberto", attempts }],
    };
  },

  draftCancelled(displayCode: string, willTransfer: boolean): TemplateSpec {
    return {
      text: willTransfer
        ? `Rascunho ${displayCode} cancelado. Nada foi criado. Como o caso é crítico, vou passar a conversa para um analista mesmo assim, com o resumo do que você contou.`
        : `Rascunho ${displayCode} cancelado. Nada foi criado. Se quiser, me conte o que mudou e eu monto outro.`,
      action: "cancelar_rascunho",
      intent: "Funcionário cancelou o rascunho",
      entities: { rascunho: displayCode },
      rationale: willTransfer
        ? "Você cancelou, então nenhum chamado foi gravado. Casos críticos são transferidos mesmo sem chamado, para não atrasar o atendimento."
        : "Você cancelou, então nenhum chamado foi gravado.",
      rules: willTransfer ? [RULE_CONFIRM, "D5 · Crítico sem confirmação é transferido só com o resumo"] : [RULE_CONFIRM],
      steps: [{ tool: "drafts.cancel", labels: ["cancelou o rascunho"], inputSummary: displayCode, outputSummary: "nada gravado" }],
    };
  },

  transferNotice(contactAt: Date, now: Date, reasonLabel: string): TemplateSpec {
    return {
      text: `Encaminhei para o service desk. Um analista fala com você em até 2 h úteis (${deadlineText(contactAt, now)}). Pode continuar escrevendo aqui: ele vê tudo.`,
      action: "avisar_transferencia",
      intent: "Conversa transferida para analista",
      entities: { motivo: reasonLabel },
      rationale: `A conversa foi transferida (${reasonLabel.toLowerCase()}). O agent fica em silêncio enquanto um analista atende.`,
      rules: [RULE_TRANSFER, "Alvo de primeiro contato humano: 2 horas úteis"],
      steps: [{ tool: "conversations.transfer", labels: ["transferiu para analista"], inputSummary: reasonLabel, outputSummary: "aguardando atendente" }],
    };
  },

  resume(ticketNumber: string | null): TemplateSpec {
    return {
      text: ticketNumber ? `Voltei. Posso continuar ajudando com o ${ticketNumber}?` : "Voltei. Posso continuar ajudando?",
      action: "retomar",
      intent: "Analista devolveu a conversa ao agent",
      rationale: "O analista devolveu a conversa; o agent retoma do ponto em que estava, com o mesmo contexto.",
      rules: ["FR-057 · Ao devolver, o agent envia uma mensagem curta de retomada"],
      steps: [{ tool: "conversations.return", labels: ["retomou o atendimento"], outputSummary: "com o agent" }],
    };
  },

  limitReached(limit: number): TemplateSpec {
    return {
      text: `Chegamos ao limite de ${limit} mensagens nesta conversa. Posso continuar em uma nova conversa, levando um resumo do que já vimos, ou chamar um analista.`,
      parts: { limit_options: true },
      action: "avisar_limite",
      intent: "Limite de mensagens da conversa atingido",
      rationale: `Cada conversa tem até ${limit} mensagens ao agent para controlar custo. A nova conversa começa com um resumo desta.`,
      rules: [`RN-010 · Limite de ${limit} mensagens por sessão`],
      steps: [{ tool: "conversations.limit", labels: ["verificou o limite"], outputSummary: `${limit}/${limit}` }],
    };
  },

  continuationOpening(summary: CaseSummary): TemplateSpec {
    const problem = summary.problem.replace(/[.\s]+$/, "");
    const draft = summary.pendingDraft ? ` O rascunho ${summary.pendingDraft} expirou; se ainda fizer sentido, monto de novo.` : "";
    return {
      text: `Continuando: ${problem}.${draft} Como quer seguir?`,
      action: "continuar_conversa",
      intent: "Continuação após o limite de mensagens",
      rationale: "A conversa anterior atingiu o limite; esta começa com o resumo dela para você não repetir nada.",
      rules: ["D2 · No limite, nova conversa com resumo herdado"],
      steps: [{ tool: "summarize", labels: ["resumiu a conversa anterior"], outputSummary: problem.slice(0, 80) }],
    };
  },
};
