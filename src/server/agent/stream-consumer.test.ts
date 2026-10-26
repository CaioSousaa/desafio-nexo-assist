import { describe, expect, it } from "vitest";
import { consumeAgentStream, type LiveStep } from "./stream-consumer";

async function* chunks(items: unknown[], onEach?: () => void) {
  for (const item of items) {
    onEach?.();
    yield item;
  }
}

function collect() {
  const steps: LiveStep[] = [];
  const texts: string[] = [];
  return { steps, texts, sink: { step: (s: LiveStep) => steps.push(structuredClone(s)), text: (t: string) => texts.push(t) } };
}

const toolCall = (id: string, toolName: string, args: Record<string, unknown> = {}) => ({ type: "tool-call", payload: { toolCallId: id, toolName, args } });
const toolResult = (id: string, toolName: string, result: unknown, args: Record<string, unknown> = {}) => ({ type: "tool-result", payload: { toolCallId: id, toolName, result, args } });
const delta = (text: string) => ({ type: "text-delta", payload: { id: "t", text } });
const finish = (reason = "stop") => ({ type: "finish", payload: { stepResult: { reason } } });

describe("consumeAgentStream", () => {
  it("monta passos na ordem de execução, com rótulos, subpassos e duração", async () => {
    let clock = 0;
    const { steps, sink } = collect();
    const result = await consumeAgentStream(
      chunks(
        [
          toolCall("1", "list_my_tickets"),
          toolResult("1", "list_my_tickets", { tickets: [{ status: "aberto", overdue: true }] }),
          toolCall("2", "get_ticket", { number: "inc-20311" }),
          toolResult("2", "get_ticket", { found: true, ticket: { status: "aguardando_analista" }, sla: { overdue: true } }, { number: "inc-20311" }),
          toolCall("3", "record_decision", { action: "consultar_chamados", confidence: 90 }),
          toolResult("3", "record_decision", { recorded: true }),
          delta("Seu chamado está vencido."),
          finish(),
        ],
        () => (clock += 10),
      ),
      sink,
      { now: () => clock },
    );
    expect(result.steps.map((s) => s.labels)).toEqual([["consultou seus chamados"], ["consultou o INC-20311", "calculou o prazo"], []]);
    expect(result.steps.map((s) => s.visible)).toEqual([true, true, false]);
    expect(result.steps[0]!.durationMs).toBe(10);
    expect(result.steps[0]!.outputSummary).toBe("1 chamado(s), 1 aberto(s), 1 vencido(s)");
    expect(steps.map((s) => `${s.tool}:${s.status}`)).toEqual([
      "list_my_tickets:running",
      "list_my_tickets:done",
      "get_ticket:running",
      "get_ticket:done",
      "record_decision:running",
      "record_decision:done",
    ]);
    expect(result.decisionCalls).toEqual([{ action: "consultar_chamados", confidence: 90 }]);
    expect(result.text).toBe("Seu chamado está vencido.");
    expect(result.finishReason).toBe("stop");
    expect(result.firstSignalMs).toBe(10);
  });

  it('"refez o rascunho" quando propose_draft substitui um pendente', async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(
      chunks([toolCall("1", "propose_draft"), toolResult("1", "propose_draft", { ok: true, displayCode: "D-382", priority: "Alta", replaced: true })]),
      sink,
    );
    expect(result.steps[0]!.labels).toEqual(["refez o rascunho"]);
  });

  it("passo falho quando o resultado traz error, com tentativas", async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(
      chunks([
        toolCall("1", "list_my_tickets"),
        toolResult("1", "list_my_tickets", { error: "tickets_unavailable", message: "O sistema de chamados está instável", attempts: 4 }),
      ]),
      sink,
    );
    expect(result.steps[0]).toMatchObject({ ok: false, attempts: 4, error: "O sistema de chamados está instável" });
    expect(result.steps[0]!.outputSummary).toMatch(/^falhou/);
  });

  it("tool-error do Mastra vira passo falho", async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(
      chunks([toolCall("1", "offer_options"), { type: "tool-error", payload: { toolCallId: "1", toolName: "offer_options", error: new Error("schema inválido") } }]),
      sink,
    );
    expect(result.steps[0]).toMatchObject({ ok: false, error: "schema inválido" });
  });

  it("coalesce deltas de texto: no máximo um evento a cada 50 ms", async () => {
    let clock = 0;
    const { texts, sink } = collect();
    const items = Array.from({ length: 20 }, (_, i) => delta(`p${i} `));
    await consumeAgentStream(chunks(items, () => (clock += 10)), sink, { now: () => clock, coalesceMs: 50 });
    // 20 deltas em 200 ms → ~4–5 eventos, nunca 20
    expect(texts.length).toBeLessThanOrEqual(6);
    expect(texts.join("")).toBe(items.map((i) => i.payload.text).join(""));
  });

  it("record_decision ausente: decisionCalls vazio (o turno faz a segunda chance)", async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(chunks([delta("Oi"), finish()]), sink);
    expect(result.decisionCalls).toEqual([]);
  });

  it("dois record_decision: guarda os dois na ordem (o turno usa o último)", async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(
      chunks([toolCall("1", "record_decision", { action: "a" }), toolCall("2", "record_decision", { action: "b" })]),
      sink,
    );
    expect(result.decisionCalls.map((d) => d.action)).toEqual(["a", "b"]);
  });

  it("chunk de erro e finish 'error' viram error no resultado", async () => {
    const { sink } = collect();
    const withChunk = await consumeAgentStream(chunks([{ type: "error", payload: { error: new Error("429") } }]), sink);
    expect(String(withChunk.error)).toContain("429");
    const withFinish = await consumeAgentStream(chunks([finish("error")]), sink);
    expect(withFinish.error).toBeInstanceOf(Error);
  });

  it("exceção no meio do stream é capturada com o texto parcial", async () => {
    const { sink } = collect();
    async function* broken() {
      yield delta("parcial");
      throw new Error("conexão caiu");
    }
    const result = await consumeAgentStream(broken(), sink);
    expect(result.text).toBe("parcial");
    expect((result.error as Error).message).toBe("conexão caiu");
  });

  it("guarda o título do artigo usado na busca", async () => {
    const { sink } = collect();
    const result = await consumeAgentStream(
      chunks([
        toolCall("1", "search_help_center", { query: "809" }),
        toolResult("1", "search_help_center", { articles: [{ title: "VPN com erro 809", appliesToEmployee: false }, { title: "VPN não conecta", appliesToEmployee: true }] }),
      ]),
      sink,
    );
    expect(result.steps[0]!.articleTitle).toBe("VPN não conecta");
    expect(result.steps[0]!.outputSummary).toBe("VPN com erro 809 (não se aplica); VPN não conecta");
  });
});
