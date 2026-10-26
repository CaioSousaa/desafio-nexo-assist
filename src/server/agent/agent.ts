import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { noopLogger } from "@mastra/core/logger";
import type { RequestContext } from "@mastra/core/request-context";
import type { RawUsage } from "./pricing";
import { buildInstructions } from "./instructions";
import { nexoTools } from "./tools";

export type HistoryMessage = { role: "user"; content: string } | { role: "assistant"; content: string };

export interface StreamOutputLike {
  fullStream: AsyncIterable<unknown>;
  usage: Promise<RawUsage | undefined>;
}

/** Fronteira entre o turno e o Mastra; testes usam o mesmo runner com um modelo roteirizado. */
export interface AgentRunner {
  readonly modelName: string;
  stream(history: HistoryMessage[], options: { requestContext: RequestContext; abortSignal?: AbortSignal }): Promise<StreamOutputLike>;
  /** Segunda chance quando o modelo responde sem chamar record_decision (só essa ferramenta, sem texto). */
  recordDecisionOnly(history: HistoryMessage[], options: { requestContext: RequestContext }): Promise<void>;
}

export type AgentModel = MastraModelConfig | Array<{ model: MastraModelConfig; maxRetries?: number }>;

export const TURN_OPTIONS = {
  maxSteps: 8,
  modelSettings: { temperature: 0.2, maxOutputTokens: 1024 },
  providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
} as const;

export const DEFAULT_TURN_TIMEOUT_MS = 90_000;

interface StepLike {
  text?: string;
  toolCalls?: Array<{ toolName?: string; payload?: { toolName?: string } }>;
}

/**
 * Encerra o loop quando o modelo já escreveu o texto final e registrou a decisão no mesmo passo:
 * evita uma ida extra ao modelo só para "fechar" o turno (cada ida custa latência e tokens).
 */
export function stopAfterDecisionWithText({ steps }: { steps: StepLike[] }): boolean {
  const last = steps.at(-1);
  if (!last?.text?.trim()) return false;
  return (last.toolCalls ?? []).some((call) => (call.toolName ?? call.payload?.toolName) === "record_decision");
}

export function createNexoAgent(model: AgentModel): Agent {
  const agent = new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    description: "Agent de atendimento do service desk de TI da Nexo.",
    instructions: ({ requestContext }) => buildInstructions(requestContext),
    model,
    tools: nexoTools,
  });
  // Falhas do modelo já viram `turn_failed` no log JSON do turno; o log do Mastra só duplicaria.
  agent.__setLogger(noopLogger);
  return agent;
}

export function createAgentRunner(model: AgentModel, modelName: string, options: { turnTimeoutMs?: number } = {}): AgentRunner {
  const agent = createNexoAgent(model);
  const timeoutMs = options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS;
  const withTimeout = (signal: AbortSignal | undefined): AbortSignal => {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  };
  return {
    modelName,
    async stream(history, { requestContext, abortSignal }) {
      const output = await agent.stream(history, {
        requestContext,
        toolChoice: "auto",
        abortSignal: withTimeout(abortSignal),
        stopWhen: stopAfterDecisionWithText as never,
        ...TURN_OPTIONS,
      });
      return {
        fullStream: output.fullStream as unknown as AsyncIterable<unknown>,
        usage: Promise.resolve(output.usage).then((u) => u as RawUsage | undefined).catch(() => undefined),
      };
    },
    async recordDecisionOnly(history, { requestContext }) {
      const output = await agent.stream(
        [
          ...history,
          {
            role: "user",
            content:
              "[sistema] Você respondeu sem registrar a decisão. Chame agora record_decision com o que entendeu, a ação escolhida, a confiança e o porquê deste turno. Não escreva texto.",
          },
        ],
        {
          requestContext,
          toolChoice: { type: "tool", toolName: "record_decision" },
          maxSteps: 1,
          abortSignal: withTimeout(undefined),
          modelSettings: TURN_OPTIONS.modelSettings,
          providerOptions: TURN_OPTIONS.providerOptions,
        },
      );
      // A ferramenta grava a decisão no scratch do turno durante o consumo do stream.
      for await (const _chunk of output.fullStream as unknown as AsyncIterable<unknown>) void _chunk;
    },
  };
}
