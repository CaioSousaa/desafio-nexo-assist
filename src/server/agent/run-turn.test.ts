import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, clientId, createTestApp, RAFAEL, type TestApp } from "@/test/harness";
import { call, decision } from "@/test/scripted-model";
import { findConversation, findOpenConversation } from "../conversations/repo";
import { takeConversation } from "../conversations/console-actions";
import { findDecisionsByMessageIds, listDecisions } from "../decisions/repo";
import { findPendingDraft } from "../drafts/repo";
import { listMessages } from "../messages/repo";
import { stopAfterDecisionWithText } from "./agent";
import { acceptEmployeeMessage, FALLBACK_RATIONALE, LimitReachedError, MODEL_ERROR_TEXT, retryAgentMessage, TIMEOUT_TEXT } from "./run-turn";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

async function send(text: string, email = ANA, id = clientId()) {
  const employee = await app.user(email);
  const accepted = await acceptEmployeeMessage(app.ctx, employee, { text, clientMessageId: id });
  await accepted.run?.();
  return accepted;
}

describe("turno do agent (Mastra + ferramentas + banco, modelo roteirizado)", () => {
  it("responde dúvida pela central de ajuda, com passos, decisão e sem chamado (US2.1)", async () => {
    app.model.push(
      { tools: [call("search_help_center", { query: "até que horas o suporte atende" })] },
      { tools: [decision({ action: "responder_central", confidence: 93, intent: "Horário do service desk" })] },
      { text: "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas." },
    );
    const accepted = await send("até que horas o suporte atende?");
    const messages = await listMessages(app.ctx.db, accepted.conversation.id);
    const reply = messages.at(-1)!;
    expect(reply.authorType).toBe("agent");
    expect(reply.status).toBe("done");
    expect(reply.text).toContain("8h às 18h");
    const decisions = await findDecisionsByMessageIds(app.ctx.db, [reply.id]);
    const d = decisions.get(reply.id)!;
    expect(d).toMatchObject({ action: "responder_central", confidence: 93, source: "modelo" });
    expect(d.steps.filter((s) => s.visible).flatMap((s) => s.labels)).toEqual(["buscou na central de ajuda"]);
    expect(d.steps.find((s) => s.tool === "search_help_center")?.articleTitle).toBe("Horário do service desk");
    expect(d.usage?.inputTokens).toBeGreaterThan(0);
    expect(await app.ctx.ticketsLocal.count()).toBe(11); // só os do seed: nenhum chamado criado
    expect(app.model.remaining).toBe(0);
  });

  it("publica passos e texto progressivo no canal do funcionário enquanto o turno acontece (FR-011)", async () => {
    app.model.push(
      { tools: [call("list_my_tickets", {}), decision({ action: "consultar_chamados" })] },
      { text: "Você tem três chamados abertos. Qual deles quer ver?" },
    );
    const accepted = await send("qual o status do meu chamado?");
    const channel = `employee:${accepted.conversation.employeeId}`;
    const types = app.events.filter((e) => e.channel === channel).map((e) => e.type);
    const firstStep = types.indexOf("step");
    const firstText = types.indexOf("text_delta");
    expect(firstStep).toBeGreaterThan(-1);
    expect(firstText).toBeGreaterThan(firstStep);
    expect(types.lastIndexOf("message")).toBeGreaterThan(firstText);
    const steps = app.eventsOf("step", channel).map((e) => (e.data as { step: { status: string; labels: string[] } }).step);
    expect(steps[0]).toMatchObject({ status: "running", labels: ["consultou seus chamados"] });
    expect(steps.some((s) => s.status === "done")).toBe(true);
  });

  it("o prompt de sistema traz o bloco dinâmico com funcionário, dispositivo e mensagens restantes", async () => {
    app.model.push({ tools: [decision()] }, { text: "Oi!" });
    await send("oi");
    const system = app.model.lastSystemPrompt();
    expect(system).toContain("Ana Souza");
    expect(system).toContain("Windows 11");
    expect(system).toContain("Mensagens restantes nesta conversa: 29 de 30");
  });

  it("mensagem repetida com o mesmo clientMessageId não duplica nem chama o modelo de novo (FR-081)", async () => {
    app.model.push({ tools: [decision()] }, { text: "Oi!" });
    const id = clientId();
    await send("oi", ANA, id);
    const again = await send("oi", ANA, id);
    expect(again.duplicate).toBe(true);
    expect(again.run).toBeNull();
    const conversation = await findConversation(app.ctx.db, again.conversation.id);
    expect(conversation?.agentMessageCount).toBe(1);
    expect((await listMessages(app.ctx.db, again.conversation.id)).filter((m) => m.authorType === "funcionario")).toHaveLength(1);
  });

  it("sem record_decision: pede de novo só a decisão (segunda chamada forçada)", async () => {
    app.model.push(
      { tools: [call("search_help_center", { query: "horário" })] },
      { text: "Atendemos das 8h às 18h." },
      { tools: [decision({ action: "responder_central", confidence: 80 })] }, // segunda chance (só record_decision)
    );
    const accepted = await send("horário?");
    const [d] = await listDecisions(app.ctx.db, accepted.conversation.id);
    expect(d).toMatchObject({ action: "responder_central", confidence: 80, source: "modelo" });
    expect(app.model.toolChoices.at(-1)).toMatchObject({ type: "tool", toolName: "record_decision" });
    expect(app.model.remaining).toBe(0);
    expect((await findConversation(app.ctx.db, accepted.conversation.id))?.state).toBe("com_agent");
  });

  it("sem record_decision mesmo após nova tentativa: decisão de reserva (confiança 0) e transferência (FR-032)", async () => {
    app.model.push({ text: "Hmm." }, { text: "ainda sem decisão" });
    const accepted = await send("??");
    const conversation = await findConversation(app.ctx.db, accepted.conversation.id);
    expect(conversation?.state).toBe("aguardando_atendente");
    expect(conversation?.transferReason).toBe("baixa_confianca");
    expect(conversation?.transferConfidence).toBe(0);
    const decisions = await listDecisions(app.ctx.db, accepted.conversation.id);
    expect(decisions[0]).toMatchObject({ source: "fallback", confidence: 0, rationale: FALLBACK_RATIONALE });
  });

  it("falha do modelo: resposta vira erro, a mensagem do funcionário fica e o retry não conta de novo (FR-027)", async () => {
    app.model.push({ error: new Error("429 quota") });
    const accepted = await send("oi");
    const agent = accepted.agentMessage!;
    let messages = await listMessages(app.ctx.db, accepted.conversation.id);
    expect(messages.find((m) => m.id === agent.id)).toMatchObject({ status: "error", text: MODEL_ERROR_TEXT });
    expect(messages.filter((m) => m.authorType === "funcionario")).toHaveLength(1);
    expect(app.eventsOf("error")).toHaveLength(2); // canais conversa + funcionário

    app.model.push({ tools: [decision()] }, { text: "Agora foi." });
    const employee = await app.user(ANA);
    const retry = await retryAgentMessage(app.ctx, employee, agent.id);
    await retry.run();
    messages = await listMessages(app.ctx.db, accepted.conversation.id);
    expect(messages.find((m) => m.id === agent.id)).toMatchObject({ status: "done", text: "Agora foi." });
    expect((await findConversation(app.ctx.db, accepted.conversation.id))?.agentMessageCount).toBe(1);
    await expect(retryAgentMessage(app.ctx, employee, agent.id)).rejects.toMatchObject({ code: "not_failed" });
  });

  it("texto final e record_decision no mesmo passo: uma única chamada ao modelo", async () => {
    app.model.push({ tools: [decision({ action: "responder_central" })], text: "Atendemos das 8h às 18h." });
    const accepted = await send("horário?");
    expect(app.model.prompts).toHaveLength(1);
    expect(app.model.remaining).toBe(0);
    const reply = (await listMessages(app.ctx.db, accepted.conversation.id)).at(-1)!;
    expect(reply).toMatchObject({ status: "done", text: "Atendemos das 8h às 18h." });
  });

  it("stopAfterDecisionWithText só para com texto e record_decision no último passo", () => {
    const decisionCall = { toolName: "record_decision" };
    expect(stopAfterDecisionWithText({ steps: [{ text: "oi", toolCalls: [decisionCall] }] })).toBe(true);
    expect(stopAfterDecisionWithText({ steps: [{ text: "", toolCalls: [decisionCall] }] })).toBe(false);
    expect(stopAfterDecisionWithText({ steps: [{ text: "oi", toolCalls: [{ toolName: "list_my_tickets" }] }] })).toBe(false);
    expect(stopAfterDecisionWithText({ steps: [{ text: "oi", toolCalls: [{ payload: { toolName: "record_decision" } }] }] })).toBe(true);
  });

  it("modelo lento além do tempo limite: erro com 'Tentar de novo', sem decisão de reserva nem transferência", async () => {
    const slow = await createTestApp({ config: { turnTimeoutMs: 300 } });
    try {
      slow.model.push(
        (_prompt, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );
      const ana = await slow.user(ANA);
      const accepted = await acceptEmployeeMessage(slow.ctx, ana, { text: "oi", clientMessageId: clientId() });
      await accepted.run?.();
      const reply = (await listMessages(slow.ctx.db, accepted.conversation.id)).find((m) => m.id === accepted.agentMessage!.id)!;
      expect(reply).toMatchObject({ status: "error", text: TIMEOUT_TEXT });
      const conversation = await findConversation(slow.ctx.db, accepted.conversation.id);
      expect(conversation?.state).toBe("com_agent");
      expect(await listDecisions(slow.ctx.db, accepted.conversation.id)).toEqual([]);
    } finally {
      slow.close();
    }
  });

  it("com a conversa aguardando atendente o agent não responde; a mensagem fica registrada (FR-042)", async () => {
    app.model.push({ tools: [call("request_transfer", { reason: "pedido", summary: { problem: "Quer analista", done: "nada", tickets: [] } }), decision({ action: "transferir" })] }, { text: "Vou chamar um analista." });
    const first = await send("quero falar com um analista");
    expect((await findConversation(app.ctx.db, first.conversation.id))?.state).toBe("aguardando_atendente");
    const second = await send("ainda estou aqui");
    expect(second.agentMessage).toBeNull();
    expect(second.run).toBeNull();
    expect(second.employeeMessage.countsTowardLimit).toBe(false);
    expect(app.model.remaining).toBe(0);
    expect((await findConversation(app.ctx.db, first.conversation.id))?.agentMessageCount).toBe(1);
  });

  it("analista assume durante a resposta: a resposta é entregue, mas nenhuma pós-ação roda (achado 3)", async () => {
    const rafael = await app.user(RAFAEL);
    app.model.push(
      { tools: [call("request_transfer", { reason: "pedido", summary: { problem: "x", done: "y", tickets: [] } }), decision({ action: "transferir" })] },
      async () => {
        const open = await findOpenConversation(app.ctx.db, "u-ana");
        await takeConversation(app.ctx, rafael, open!.id);
        return { text: "Vou chamar um analista." };
      },
    );
    const accepted = await send("quero um analista");
    const conversation = await findConversation(app.ctx.db, accepted.conversation.id);
    expect(conversation?.state).toBe("com_analista");
    expect(conversation?.assignedAnalystId).toBe("u-rafael");
    const reply = (await listMessages(app.ctx.db, accepted.conversation.id)).find((m) => m.id === accepted.agentMessage!.id);
    expect(reply?.status).toBe("done");
  });

  it("limite atingido: próxima mensagem recebe 409 limit_reached (FR-071)", async () => {
    const smallApp = await createTestApp({ config: { messageLimit: 2 } });
    try {
      const employee = await smallApp.user(ANA);
      for (const text of ["um", "dois"]) {
        smallApp.model.push({ tools: [decision()] }, { text: `ok ${text}` });
        const accepted = await acceptEmployeeMessage(smallApp.ctx, employee, { text, clientMessageId: clientId() });
        await accepted.run?.();
      }
      const open = await findOpenConversation(smallApp.ctx.db, employee.id);
      expect(open?.limitReached).toBe(true);
      await expect(acceptEmployeeMessage(smallApp.ctx, employee, { text: "três", clientMessageId: clientId() })).rejects.toBeInstanceOf(LimitReachedError);
      const last = (await listMessages(smallApp.ctx.db, open!.id)).at(-1)!;
      expect(last.parts.limit_options).toBe(true);
    } finally {
      smallApp.close();
    }
  });

  it("rascunho criado pelo turno fica pendente e referenciado na mensagem (US3.2)", async () => {
    app.model.push(
      {
        tools: [
          call("classify_priority", { kind: "INC", impact: "somente_voce", blocksWork: true, sameDayCommitment: true, hasWorkaround: false }),
          call("propose_draft", {
            kind: "novo",
            title: "VPN não conecta (erro 809)",
            description: "Notebook Windows 11 não conecta na VPN desde ontem; erro 809. Reunião com cliente às 14h.",
            type: "INC",
            category: "Rede e VPN",
            affected: "somente_voce",
            classification: { blocksWork: true, sameDayCommitment: true, hasWorkaround: false },
            duplicateCheck: { considered: ["INC-20311", "INC-20298"], verdict: "diferente", why: "Nenhum é sobre VPN." },
          }),
          decision({ action: "propor_chamado", confidence: 88 }),
        ],
      },
      { text: "Prioridade Alta: você tem reunião hoje. Confere o rascunho?" },
    );
    const accepted = await send("Só eu. Tenho reunião com cliente às 14h");
    const pending = await findPendingDraft(app.ctx.db, accepted.conversation.id);
    expect(pending?.payload).toMatchObject({ type: "INC", category: "Rede e VPN", priority: "Alta", affected: "somente_voce" });
    const reply = (await listMessages(app.ctx.db, accepted.conversation.id)).at(-1)!;
    expect(reply.parts.draft_id).toBe(pending?.id);
    const d = (await findDecisionsByMessageIds(app.ctx.db, [reply.id])).get(reply.id)!;
    expect(d.steps.filter((s) => s.visible).flatMap((s) => s.labels)).toEqual([
      "classificou a prioridade",
      "consultou o SLA",
      "montou o rascunho",
    ]);
    expect(await app.ctx.ticketsLocal.count()).toBe(11);
  });
});
