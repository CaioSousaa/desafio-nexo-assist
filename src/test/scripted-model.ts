import { MastraLanguageModelV2Mock, simulateReadableStream } from "@mastra/core/test-utils/llm-mock";

/** Uma chamada do modelo: chama ferramentas e/ou escreve texto. Função = decide a partir do prompt. */
export type ModelStep =
  | { tools?: Array<{ name: string; args: Record<string, unknown> }>; text?: string; error?: undefined }
  | { error: Error };

export type ScriptEntry = ModelStep | ((prompt: unknown) => ModelStep | Promise<ModelStep>);

const usage = { inputTokens: 1200, outputTokens: 80, totalTokens: 1280 };

export function call(name: string, args: Record<string, unknown> = {}) {
  return { name, args };
}

export function decision(overrides: Partial<{ intent: string; action: string; confidence: number; rationale: string; rules: string[]; assumptions: string[]; entities: Array<{ name: string; value: string }> }> = {}) {
  return call("record_decision", {
    understanding: {
      intent: overrides.intent ?? "Dúvida do funcionário",
      entities: overrides.entities ?? [],
      assumptions: overrides.assumptions ?? [],
    },
    action: overrides.action ?? "responder_central",
    confidence: overrides.confidence ?? 90,
    rationale: overrides.rationale ?? "Motivo de teste.",
    rules: overrides.rules ?? [],
  });
}

/**
 * Modelo roteirizado sobre o mock do Mastra: cada `doStream` consome o próximo passo da fila.
 * Permite testar o turno inteiro (Mastra + ferramentas + banco) sem chamar o Gemini.
 */
export class ScriptedModel {
  readonly queue: ScriptEntry[] = [];
  readonly prompts: unknown[] = [];
  readonly toolChoices: unknown[] = [];
  private counter = 0;
  readonly mock: MastraLanguageModelV2Mock;

  constructor() {
    this.mock = new MastraLanguageModelV2Mock({
      doStream: async (options) => {
        this.prompts.push(options.prompt);
        this.toolChoices.push(options.toolChoice);
        const entry = this.queue.shift();
        if (!entry) throw new Error("ScriptedModel: roteiro vazio (o turno chamou o modelo mais vezes que o esperado)");
        const step = typeof entry === "function" ? await entry(options.prompt) : entry;
        if (step.error) throw step.error;
        const chunks: unknown[] = [{ type: "stream-start", warnings: [] }];
        for (const tool of step.tools ?? []) {
          this.counter += 1;
          chunks.push({ type: "tool-call", toolCallId: `call-${this.counter}`, toolName: tool.name, input: JSON.stringify(tool.args) });
        }
        if (step.text) {
          const id = `text-${this.counter}`;
          chunks.push({ type: "text-start", id });
          for (const piece of step.text.match(/.{1,12}/gs) ?? []) chunks.push({ type: "text-delta", id, delta: piece });
          chunks.push({ type: "text-end", id });
        }
        chunks.push({ type: "finish", finishReason: step.tools?.length ? "tool-calls" : "stop", usage });
        return { stream: simulateReadableStream({ chunks: chunks as never[] }) };
      },
    });
  }

  /** Enfileira passos do modelo. */
  push(...entries: ScriptEntry[]): this {
    this.queue.push(...entries);
    return this;
  }

  /** Turno típico: ferramentas + record_decision num passo, texto no seguinte. */
  turn(tools: Array<{ name: string; args: Record<string, unknown> }>, text: string): this {
    return this.push({ tools }, { text });
  }

  /** Texto do prompt de sistema enviado na última chamada. */
  lastSystemPrompt(): string {
    const prompt = this.prompts.at(-1) as Array<{ role: string; content: unknown }> | undefined;
    return (prompt ?? [])
      .filter((m) => m.role === "system")
      .map((m) => String(m.content))
      .join("\n");
  }

  get remaining(): number {
    return this.queue.length;
  }
}
