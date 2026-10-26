import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "@/test/harness";
import { listDecisions } from "../decisions/repo";
import { agentDecisions, messages } from "../db/schema";
import { getMessage, parseParts } from "./repo";

describe("leitura tolerante de partes ricas (compat-f)", () => {
  it("parts ausente, vazio ou nulo → {}", () => {
    expect(parseParts(null)).toEqual({});
    expect(parseParts(undefined)).toEqual({});
    expect(parseParts({})).toEqual({});
  });

  it("campo desconhecido é ignorado; os conhecidos continuam", () => {
    expect(parseParts({ quick_options: ["Sim"], novidade: 1 })).toEqual({ quick_options: ["Sim"] });
  });

  it("campo conhecido com formato inválido vira ausente sem derrubar os outros", () => {
    expect(parseParts({ quick_options: "não é lista", draft_id: "d1" })).toEqual({ draft_id: "d1" });
    expect(parseParts({ ticket_card: { number: "INC-1" } })).toEqual({});
  });

  it("JSON inválido ou valor que não é objeto → {}", () => {
    expect(parseParts("{quebrado")).toEqual({});
    expect(parseParts("[1,2]")).toEqual({});
    expect(parseParts(42)).toEqual({});
  });

  it("card sem os campos novos recebe padrões", () => {
    const parts = parseParts({
      ticket_card: { number: "INC-20311", title: "t", status: "aberto", priority: "Média", category: "Hardware", createdAt: "x", updatedAt: "y" },
    });
    expect(parts.ticket_card).toMatchObject({ number: "INC-20311", overdue: false, overdueByText: null, description: "" });
  });
});

describe("linhas antigas no banco", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  it("mensagem com parts inválido carrega com partes vazias", async () => {
    await app.ctx.db.insert(messages).values({
      id: "m-old",
      conversationId: "seed-conv-elisa",
      authorType: "agent",
      text: "antiga",
      parts: "{nao-json" as unknown as object,
      status: "done",
      createdAt: new Date().toISOString(),
    });
    expect(await getMessage(app.ctx.db, "m-old")).toMatchObject({ text: "antiga", parts: {} });
  });

  it("decisão com passos sem 'attempts' assume 1 tentativa", async () => {
    await app.ctx.db.insert(agentDecisions).values({
      id: "d-old",
      conversationId: "seed-conv-elisa",
      messageId: "m-x",
      understanding: { intent: "x" },
      action: "responder_central",
      confidence: 80,
      rationale: "r",
      rules: [],
      steps: [{ id: "s1", tool: "search_help_center", labels: ["buscou na central de ajuda"], inputSummary: "q", outputSummary: "o", durationMs: 5, ok: true }],
      createdAt: new Date().toISOString(),
    });
    const decision = (await listDecisions(app.ctx.db, "seed-conv-elisa")).find((d) => d.id === "d-old")!;
    expect(decision.steps[0]!.attempts).toBe(1);
    expect(decision.understanding).toEqual({ intent: "x", entities: {}, assumptions: [] });
  });
});
