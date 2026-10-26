import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, createTestApp, type TestApp } from "@/test/harness";
import { findOpenConversation, insertConversation, updateConversation } from "../conversations/repo";
import type { Decision } from "../decisions/repo";
import { proposeDraft } from "../drafts/service";
import type { Message } from "../messages/repo";
import { buildHistory } from "./context";
import { buildDynamicBlock, buildInstructions, STATIC_INSTRUCTIONS } from "./instructions";
import { createRequestContext, createTurnScratch } from "./tools/context";

const message = (overrides: Partial<Message>): Message => ({
  id: crypto.randomUUID(),
  conversationId: "c1",
  authorType: "funcionario",
  authorId: null,
  text: "",
  parts: {},
  eventType: null,
  decisionId: null,
  clientMessageId: null,
  status: null,
  countsTowardLimit: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("buildHistory", () => {
  it("funcionário vira user; agent vira assistant com prefixo [ações: …]", () => {
    const agent = message({ authorType: "agent", status: "done", text: "Montei o rascunho.", parts: { draft_id: "d1", quick_options: ["Sim", "Não"] } });
    const decisions = new Map<string, Decision>([
      [agent.id, { steps: [{ labels: ["consultou seus chamados"], visible: true }, { labels: ["montou o rascunho"], visible: true }, { labels: [], visible: false }] } as unknown as Decision],
    ]);
    const history = buildHistory([message({ text: "VPN não conecta" }), agent], decisions);
    expect(history).toEqual([
      { role: "user", content: "VPN não conecta" },
      { role: "assistant", content: "[ações: consultou seus chamados; montou o rascunho; opções: Sim / Não] Montei o rascunho." },
    ]);
  });

  it("ignora respostas pendentes/com erro e a mensagem excluída; analista e eventos entram marcados", () => {
    const pending = message({ authorType: "agent", status: "pending" });
    const history = buildHistory(
      [
        message({ text: "oi" }),
        message({ authorType: "agent", status: "error", text: "Não consegui responder agora." }),
        message({ authorType: "sistema", text: "Transferida para o service desk · 10:05" }),
        message({ authorType: "analista", text: "Olá, sou o Rafael." }),
        pending,
      ],
      new Map(),
      [pending.id],
    );
    expect(history).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "[evento: Transferida para o service desk · 10:05]" },
      { role: "assistant", content: "[analista do service desk] Olá, sou o Rafael." },
    ]);
  });

  it("limita a janela às 40 mensagens mais recentes", () => {
    const many = Array.from({ length: 60 }, (_, i) => message({ text: `m${i}` }));
    const history = buildHistory(many, new Map());
    expect(history).toHaveLength(40);
    expect(history[0]!.content).toBe("m20");
  });
});

describe("bloco dinâmico das instruções (FR-028)", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(() => app.close());

  async function block(setup?: (conversationId: string) => Promise<void>) {
    const ana = await app.user(ANA);
    const conversation = await insertConversation(app.ctx.db, { employeeId: ana.id, createdAt: app.clock.now.toISOString() });
    await setup?.(conversation.id);
    const fresh = (await findOpenConversation(app.ctx.db, ana.id))!;
    const { findPendingDraft } = await import("../drafts/repo");
    const pendingDraft = await findPendingDraft(app.ctx.db, fresh.id);
    return buildDynamicBlock(createRequestContext({ app: app.ctx, employee: ana, conversation: fresh, pendingDraft, scratch: createTurnScratch() }));
  }

  it("traz nome, departamento, dispositivo/SO, agora em São Paulo e mensagens restantes", async () => {
    const text = await block();
    expect(text).toContain("Ana Souza");
    expect(text).toContain("Financeiro");
    expect(text).toContain("Notebook Dell Latitude 5440");
    expect(text).toContain("Windows 11");
    expect(text).toContain("26 out, 10:00");
    expect(text).toContain("segunda-feira");
    expect(text).toContain("Mensagens restantes nesta conversa: 30 de 30");
  });

  it("traz rascunho pendente (com código), chamado em foco, transferência agendada e resumo herdado", async () => {
    const text = await block(async (id) => {
      await updateConversation(app.ctx.db, id, {
        focusTicket: "INC-20311",
        relatedTickets: ["INC-20311"],
        pendingTransfer: true,
        inheritedSummary: "Problema: VPN com erro 809",
        agentMessageCount: 7,
      });
      const conversation = (await findOpenConversation(app.ctx.db, "u-ana"))!;
      await proposeDraft(app.ctx, conversation, {
        kind: "novo",
        payload: { title: "VPN não conecta", description: "erro 809", type: "INC", category: "Rede e VPN", priority: "Alta", affected: "somente_voce", deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] },
      });
    });
    expect(text).toMatch(/rascunho pendente D-\d+ \(novo\)/);
    expect(text).toContain('"category":"Rede e VPN"');
    expect(text).toContain("Chamado em foco nesta conversa: INC-20311");
    expect(text).toContain("Caso crítico");
    expect(text).toContain("Resumo da conversa anterior");
    expect(text).toContain("Mensagens restantes nesta conversa: 23 de 30");
  });

  it("instruções = bloco estático (cache) + dinâmico; sem turno, só o estático", async () => {
    const { RequestContext } = await import("@mastra/core/request-context");
    expect(buildInstructions(new RequestContext())).toBe(STATIC_INSTRUCTIONS);
    expect(STATIC_INSTRUCTIONS).toContain("record_decision");
    expect(STATIC_INSTRUCTIONS).toContain("no máximo 2 perguntas");
    expect(STATIC_INSTRUCTIONS).toContain("Nunca invente número de chamado");
  });
});
