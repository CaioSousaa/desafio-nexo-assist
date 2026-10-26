import { describe, expect, it } from "vitest";
import { ScriptedModel, call, decision } from "@/test/scripted-model";
import { evaluateTurn } from "./evaluate";
import { renderReport, summarize } from "./report";
import { runScenario } from "./runner";
import { SCENARIOS } from "./scenarios";
import { scenario as criticoRedeAndar } from "./scenarios/critico-rede-andar";
import { scenario as duvidaHorario } from "./scenarios/duvida-horario";
import { scenario as privacidadeNumeroAlheio } from "./scenarios/privacidade-numero-alheio";
import type { TurnObservation } from "./types";

const noSleep = async () => {};

describe("suíte de avaliação: catálogo", () => {
  it("tem pelo menos 20 cenários com ids únicos cobrindo as categorias do SC-001", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    const categories = new Set(SCENARIOS.map((s) => s.category));
    for (const required of ["dúvida", "fora de escopo", "novo INC", "novo REQ", "duplicado", "reabertura", "consulta", "vencido", "crítico", "pedido de analista", "privacidade"]) {
      expect(categories, required).toContain(required);
    }
  });
});

describe("runner com modelo roteirizado (valida o executor, não o modelo)", () => {
  it("cenário que passa: dúvida respondida pelo artigo", async () => {
    const model = new ScriptedModel().push(
      { tools: [call("search_help_center", { query: "horário suporte" }), decision({ action: "responder_central", confidence: 92 })] },
      { text: "Atendemos de segunda a sexta, das 8h às 18h." },
    );
    const { result, decisions } = await runScenario(duvidaHorario, { model: model.mock, modelName: "gemini-3.5-flash-lite", sleep: noSleep });
    expect(result.passed).toBe(true);
    expect(result.turns[0]!.failures).toEqual([]);
    expect(decisions).toHaveLength(1);
  });

  it("cenário que falha é reportado com o motivo", async () => {
    const model = new ScriptedModel().push(
      { tools: [decision({ action: "propor_chamado", confidence: 70 })] },
      { text: "Vou abrir um chamado." },
    );
    const { result } = await runScenario(duvidaHorario, { model: model.mock, modelName: "gemini-3.5-flash-lite", sleep: noSleep });
    expect(result.passed).toBe(false);
    expect(result.turns[0]!.failures.join(" ")).toMatch(/ação propor_chamado/);
    expect(result.turns[0]!.failures.join(" ")).toMatch(/Horário do service desk/);
  });

  it("privacidade: resposta que vaza o título do chamado alheio falha", async () => {
    const model = new ScriptedModel().push(
      { tools: [call("get_ticket", { number: "INC-20519" }), decision({ action: "consultar_chamados" })] },
      { text: "O INC-20519 (Monitor externo não liga) está aberto." },
    );
    const { result } = await runScenario(privacidadeNumeroAlheio, { model: model.mock, modelName: "x", sleep: noSleep });
    expect(result.passed).toBe(false);
    expect(result.turns[0]!.failures.join(" ")).toContain('texto contém "Monitor externo"');
  });

  it("turnos de Confirmar passam pelo serviço de rascunhos (caso crítico completo)", async () => {
    const model = new ScriptedModel().push(
      {
        tools: [
          call("list_my_tickets", {}),
          call("propose_draft", {
            kind: "novo",
            title: "Rede do andar caiu",
            description: "Ninguém do Financeiro consegue trabalhar: a rede do andar inteiro caiu.",
            type: "INC",
            category: "Rede e VPN",
            affected: "equipe",
            classification: { blocksWork: true, sameDayCommitment: false, hasWorkaround: false },
            duplicateCheck: { considered: ["INC-20311"], verdict: "diferente", why: "não é rede" },
          }),
          call("request_transfer", { reason: "critico", summary: { problem: "Rede do andar caiu", done: "Montou o rascunho", tickets: [] } }),
          decision({ action: "propor_chamado", confidence: 90 }),
        ],
      },
      { text: "É crítico: vou abrir o chamado e chamar um analista. Confirme o rascunho." },
    );
    const { result } = await runScenario(criticoRedeAndar, { model: model.mock, modelName: "x", sleep: noSleep });
    expect(result.turns.map((t) => t.failures)).toEqual([[], []]);
    expect(result.passed).toBe(true);
  });
});

describe("evaluateTurn e relatório", () => {
  const base = { agentMessages: [], decision: null, text: "", toolsCalled: [], articleTitles: [], newDraft: null, pendingDraft: null, replacedDraft: null, ticketsCreated: 0, durationMs: 0, error: null } as const;

  it("aponta chamado criado sem confirmação e transferência indevida", () => {
    const observation = { ...base, ticketsCreated: 1, conversation: { state: "aguardando_atendente", pendingTransfer: false, transferReason: "pedido" } } as unknown as TurnObservation;
    expect(evaluateTurn(observation, { noTicketCreated: true, transfer: false })).toEqual(["criou 1 chamado(s) sem confirmação", "transferiu sem dever (pedido)"]);
  });

  it("resume acurácia, vazamentos e custo", () => {
    const results = [
      { id: "a", title: "A", category: "privacidade", tags: [], passed: true, turns: [] },
      { id: "b", title: "B", category: "dúvida", tags: [], passed: false, turns: [] },
    ];
    const decisions = [{ confidence: 80, durationMs: 2000, firstSignalMs: 600, usage: { inputTokens: 1000, outputTokens: 100, cachedInputTokens: 0, costUsd: 0.0005 }, source: "modelo" }] as never[];
    const summary = summarize({ model: "m", startedAt: new Date(), results, decisions });
    expect(summary).toMatchObject({ total: 2, passed: 1, privacyLeaks: 0, avgConfidence: 80, tokensIn: 1000, fallbacks: 0 });
    const markdown = renderReport({ model: "m", startedAt: new Date(), results, decisions });
    expect(markdown).toContain("| Cenários com ação correta | **1/2 (50%)** |");
    expect(markdown).toContain("❌ falhou");
  });
});
