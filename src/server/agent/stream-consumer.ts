import type { DecisionStep } from "../decisions/repo";
import { stepLabels, summarizeInput, summarizeOutput } from "./labels";

// Consome o `fullStream` do Mastra e transforma em passos (FR-011), texto progressivo e registro de decisão.

export interface LiveStep extends DecisionStep {
  status: "running" | "done";
}

export interface ConsumerSink {
  step(step: LiveStep): void;
  text(delta: string): void;
}

export interface ConsumeResult {
  text: string;
  steps: DecisionStep[];
  /** Argumentos de cada chamada a record_decision, na ordem. */
  decisionCalls: Array<Record<string, unknown>>;
  finishReason: string | null;
  error: unknown;
  /** ms entre o início e o primeiro passo ou texto visível (SC-005). */
  firstSignalMs: number | null;
}

interface Chunk {
  type: string;
  payload?: Record<string, unknown>;
}

export interface ConsumeOptions {
  now?: () => number;
  /** Junta deltas de texto em no máximo um evento a cada N ms. */
  coalesceMs?: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function errorText(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "erro desconhecido");
}

export async function consumeAgentStream(
  stream: AsyncIterable<unknown>,
  sink: ConsumerSink,
  options: ConsumeOptions = {},
): Promise<ConsumeResult> {
  const now = options.now ?? Date.now;
  const coalesceMs = options.coalesceMs ?? 50;
  const startedAt = now();
  const steps = new Map<string, LiveStep>();
  const stepStart = new Map<string, number>();
  const decisionCalls: Array<Record<string, unknown>> = [];
  let text = "";
  let buffer = "";
  let lastFlush = Number.NEGATIVE_INFINITY;
  let finishReason: string | null = null;
  let error: unknown = null;
  let firstSignalMs: number | null = null;

  const markSignal = () => {
    firstSignalMs ??= now() - startedAt;
  };
  const flush = () => {
    if (!buffer) return;
    markSignal();
    sink.text(buffer);
    buffer = "";
    lastFlush = now();
  };

  try {
    for await (const raw of stream) {
      const chunk = raw as Chunk;
      const payload = asRecord(chunk.payload);
      switch (chunk.type) {
        case "text-delta": {
          const delta = typeof payload.text === "string" ? payload.text : "";
          text += delta;
          buffer += delta;
          if (now() - lastFlush >= coalesceMs) flush();
          break;
        }
        case "tool-call": {
          flush();
          const id = String(payload.toolCallId ?? `call-${steps.size + 1}`);
          const tool = String(payload.toolName ?? "desconhecida");
          const args = asRecord(payload.args);
          if (tool === "record_decision") decisionCalls.push(args);
          const { labels, visible } = stepLabels(tool, args, null);
          const step: LiveStep = {
            id,
            tool,
            labels,
            visible,
            inputSummary: summarizeInput(tool, args),
            outputSummary: "",
            durationMs: 0,
            ok: true,
            error: null,
            attempts: 1,
            status: "running",
          };
          steps.set(id, step);
          stepStart.set(id, now());
          if (visible) markSignal();
          sink.step(step);
          break;
        }
        case "tool-result":
        case "tool-error": {
          const id = String(payload.toolCallId ?? "");
          const tool = String(payload.toolName ?? steps.get(id)?.tool ?? "desconhecida");
          const args = asRecord(payload.args);
          const isError = chunk.type === "tool-error" || payload.isError === true;
          const result = isError ? { error: errorText(payload.error ?? payload.result) } : asRecord(payload.result);
          const failed = isError || typeof result.error === "string";
          const previous = steps.get(id);
          const { labels, visible } = stepLabels(tool, { ...args, ...(previous ? {} : {}) }, result);
          const step: LiveStep = {
            ...(previous ?? {
              id,
              tool,
              inputSummary: summarizeInput(tool, args),
              error: null,
            }),
            labels,
            visible,
            outputSummary: summarizeOutput(tool, result),
            durationMs: Math.max(0, now() - (stepStart.get(id) ?? now())),
            ok: !failed,
            error: failed ? String(result.message ?? result.error) : null,
            attempts: typeof result.attempts === "number" && result.attempts > 0 ? result.attempts : 1,
            status: "done",
            ...(tool === "search_help_center" ? { articleTitle: firstArticleTitle(result) } : {}),
          } as LiveStep;
          steps.set(id, step);
          sink.step(step);
          break;
        }
        case "error":
          error = payload.error ?? new Error("falha no modelo");
          break;
        case "finish": {
          const stepResult = asRecord(payload.stepResult);
          finishReason = typeof stepResult.reason === "string" ? stepResult.reason : "stop";
          if (finishReason === "error" && !error) error = new Error("o modelo terminou com erro");
          break;
        }
        default:
          break;
      }
    }
  } catch (thrown) {
    error = thrown;
  }
  flush();

  return {
    text: text.trim(),
    steps: [...steps.values()].map((live) => {
      const step: DecisionStep & { status?: string } = { ...live };
      delete step.status;
      return step;
    }),
    decisionCalls,
    finishReason,
    error,
    firstSignalMs,
  };
}

function firstArticleTitle(result: Record<string, unknown>): string | undefined {
  const articles = Array.isArray(result.articles) ? (result.articles as Array<Record<string, unknown>>) : [];
  const applicable = articles.find((a) => a.appliesToEmployee !== false) ?? articles[0];
  return applicable && typeof applicable.title === "string" ? applicable.title : undefined;
}
