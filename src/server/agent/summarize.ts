import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import { z } from "zod";
import type { Draft } from "../drafts/repo";
import { logger } from "../logger";
import type { CaseSummary, Message } from "../messages/repo";
import type { AgentModel } from "./agent";

export interface SummaryInput {
  messages: Message[];
  tickets: string[];
  pendingDraft?: Draft | null;
  reason?: string;
}

/** Resumos do caso: no topo da conversa transferida (FR-041) e herdado ao continuar (FR-072). */
export interface Summarizer {
  forTransfer(input: SummaryInput): Promise<CaseSummary>;
  forContinuation(input: SummaryInput): Promise<CaseSummary>;
}

const summarySchema = z.object({
  problem: z.string().describe("Problema do funcionário em uma frase"),
  done: z.string().describe("O que o agent já fez, em uma ou duas frases"),
  tickets: z.array(z.string()).describe("Números de chamados relacionados (INC-#####/REQ-#####)"),
  priority: z.string().nullable().describe("Prioridade, se houver chamado ou rascunho"),
});

function transcript(messages: Message[]): string {
  return messages
    .filter((m) => m.text.trim() && m.status !== "error" && m.status !== "pending")
    .slice(-30)
    .map((m) => {
      const who = { funcionario: "Funcionário", agent: "Nexo Assist", analista: "Analista", sistema: "Sistema" }[m.authorType];
      return `${who}: ${m.text.trim()}`;
    })
    .join("\n");
}

/** Resumo sem modelo: usado como reserva quando a chamada ao modelo falha. */
export function fallbackSummary(input: SummaryInput): CaseSummary {
  const fromEmployee = input.messages.filter((m) => m.authorType === "funcionario" && m.text.trim());
  const first = fromEmployee[0]?.text.trim() ?? "Funcionário pediu atendimento.";
  const problem = first.length > 180 ? `${first.slice(0, 177)}…` : first;
  const agentReplies = input.messages.filter((m) => m.authorType === "agent" && m.status === "done").length;
  const done = agentReplies > 0
    ? `O agent trocou ${agentReplies} mensagem(ns) com o funcionário${input.tickets.length ? ` e consultou ${input.tickets.join(", ")}` : ""}.`
    : "O agent ainda não respondeu.";
  return {
    problem,
    done,
    tickets: input.tickets,
    priority: input.pendingDraft?.payload.priority ?? null,
    pendingDraft: input.pendingDraft ? input.pendingDraft.displayCode : null,
  };
}

export function createModelSummarizer(model: AgentModel): Summarizer {
  const agent = new Agent({
    id: "nexo-summarizer",
    name: "Nexo Assist (resumo)",
    instructions:
      "Você resume atendimentos do service desk de TI da Nexo para um analista humano. Escreva em português do Brasil, frases curtas, só com fatos que aparecem na conversa. Nunca invente número de chamado.",
    model,
  });
  agent.__setLogger(noopLogger);

  async function summarize(input: SummaryInput, purpose: string): Promise<CaseSummary> {
    const prompt = [
      purpose,
      input.reason ? `Motivo: ${input.reason}.` : "",
      input.tickets.length ? `Chamados relacionados: ${input.tickets.join(", ")}.` : "Sem chamados relacionados.",
      input.pendingDraft
        ? `Rascunho pendente ${input.pendingDraft.displayCode}: ${input.pendingDraft.payload.title} (${input.pendingDraft.payload.priority}).`
        : "",
      "Conversa:",
      transcript(input.messages),
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const result = await agent.generate(prompt, {
        structuredOutput: { schema: summarySchema },
        modelSettings: { temperature: 0, maxOutputTokens: 400 },
        abortSignal: AbortSignal.timeout(20_000),
      });
      const parsed = summarySchema.parse(result.object);
      const known = new Set(input.tickets);
      return {
        ...parsed,
        // só números que existem nos dados (FR-022)
        tickets: parsed.tickets.filter((t) => known.has(t.toUpperCase())).concat(input.tickets.filter((t) => !parsed.tickets.includes(t))),
        pendingDraft: input.pendingDraft?.displayCode ?? null,
      };
    } catch (error) {
      logger.warn("summary_fallback", { error });
      return fallbackSummary(input);
    }
  }

  return {
    forTransfer: (input) => summarize(input, "Resuma o caso para o analista que vai assumir a conversa."),
    forContinuation: (input) =>
      summarize(input, "Resuma a conversa para continuar em uma nova conversa (o funcionário atingiu o limite de mensagens)."),
  };
}

/** Resumidor determinístico (testes e reserva). */
export const deterministicSummarizer: Summarizer = {
  forTransfer: async (input) => fallbackSummary(input),
  forContinuation: async (input) => fallbackSummary(input),
};
