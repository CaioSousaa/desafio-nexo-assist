import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, clientId, createTestApp, RAFAEL, type TestApp } from "@/test/harness";
import { decision } from "@/test/scripted-model";
import type { Summarizer } from "../agent/summarize";
import { acceptEmployeeMessage, LimitReachedError } from "../agent/run-turn";
import { findDraft } from "../drafts/repo";
import { cancelDraft, confirmDraft, proposeDraft } from "../drafts/service";
import { listMessages } from "../messages/repo";
import { returnToAgent, sendAnalystMessage, takeConversation } from "./console-actions";
import { continueInNewConversation, transferAtLimit } from "./limit";
import { findConversation, findOpenConversation } from "./repo";

const summarizer: Summarizer = {
  forTransfer: async () => ({ problem: "x", done: "y", tickets: [] }),
  forContinuation: async (input) => ({
    problem: "você estava abrindo um chamado sobre a VPN",
    done: "Consultou os chamados e montou um rascunho",
    tickets: input.tickets,
    priority: "Alta",
    pendingDraft: input.pendingDraft?.displayCode ?? null,
  }),
};

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp({ config: { messageLimit: 3 }, summarizer });
});
afterEach(() => app.close());

async function say(text: string) {
  const ana = await app.user(ANA);
  app.model.push({ tools: [decision()] }, { text: `ok: ${text}` });
  const accepted = await acceptEmployeeMessage(app.ctx, ana, { text, clientMessageId: clientId() });
  await accepted.run?.();
  return accepted;
}

async function current() {
  return (await findOpenConversation(app.ctx.db, "u-ana"))!;
}

describe("limite de mensagens por sessão (FR-070–FR-072)", () => {
  it("contam texto, opção rápida e seleção de chamado (toda mensagem ao agent)", async () => {
    await say("Meu notebook não conecta na VPN");
    await say("Só eu");
    expect((await current()).agentMessageCount).toBe(2);
    const counted = (await listMessages(app.ctx.db, (await current()).id)).filter((m) => m.countsTowardLimit);
    expect(counted.map((m) => m.text)).toEqual(["Meu notebook não conecta na VPN", "Só eu"]);
  });

  it("Confirmar/Cancelar de rascunho não contam", async () => {
    await say("um");
    const ana = await app.user(ANA);
    const conversation = await current();
    const draftPayload = { title: "t", description: "d", type: "INC" as const, category: "Outros" as const, priority: "Média" as const, affected: "somente_voce" as const, deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] };
    const a = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: draftPayload });
    await cancelDraft(app.ctx, a.draft.id, ana);
    const b = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: draftPayload });
    await confirmDraft(app.ctx, b.draft.id, ana);
    expect((await current()).agentMessageCount).toBe(1);
  });

  it("na última mensagem o agent responde e anexa a mensagem de limite com as duas opções; campo bloqueia (409)", async () => {
    await say("um");
    await say("dois");
    await say("três");
    const conversation = await current();
    expect(conversation.limitReached).toBe(true);
    const messages = await listMessages(app.ctx.db, conversation.id);
    const [reply, event, limit] = messages.slice(-3);
    expect(reply!.text).toBe("ok: três");
    expect(event!.eventType).toBe("limite");
    expect(limit).toMatchObject({ authorType: "agent", text: expect.stringContaining("Chegamos ao limite de 3 mensagens"), parts: { limit_options: true } });
    const ana = await app.user(ANA);
    await expect(acceptEmployeeMessage(app.ctx, ana, { text: "quatro", clientMessageId: clientId() })).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("mensagens trocadas com analista não contam; ao voltar ao agent no limite, recebe a mensagem de limite (achado 4)", async () => {
    await say("um");
    await say("dois");
    const rafael = await app.user(RAFAEL);
    const ana = await app.user(ANA);
    const conversation = await current();
    await takeConversation(app.ctx, rafael, conversation.id);
    await acceptEmployeeMessage(app.ctx, ana, { text: "com o analista 1", clientMessageId: clientId() });
    await sendAnalystMessage(app.ctx, rafael, conversation.id, { text: "oi", clientMessageId: clientId() });
    expect((await current()).agentMessageCount).toBe(2);
    await returnToAgent(app.ctx, rafael, conversation.id);
    await say("três"); // 3ª ao agent: responde e bate o limite
    expect((await current()).limitReached).toBe(true);
  });

  it("contador em 30 sem limit_reached (devolvida no limite): a próxima mensagem recebe o aviso em vez de 409", async () => {
    await say("um");
    await say("dois");
    const conversation = await current();
    const { updateConversation } = await import("./repo");
    await updateConversation(app.ctx.db, conversation.id, { agentMessageCount: 3 });
    const ana = await app.user(ANA);
    const accepted = await acceptEmployeeMessage(app.ctx, ana, { text: "mais uma", clientMessageId: clientId() });
    expect(accepted.run).toBeNull();
    expect(accepted.employeeMessage.countsTowardLimit).toBe(false);
    expect(accepted.conversation.limitReached).toBe(true);
    expect((await listMessages(app.ctx.db, conversation.id)).at(-1)?.parts.limit_options).toBe(true);
    expect(app.model.remaining).toBe(0);
  });

  it('"Continuar em nova conversa": encerra a atual (limite), expira o rascunho e abre outra com 0/N e resumo herdado', async () => {
    await say("um");
    const conversation = await current();
    const { draft } = await proposeDraft(app.ctx, conversation, {
      kind: "novo",
      payload: { title: "VPN", description: "erro 809", type: "INC", category: "Rede e VPN", priority: "Alta", affected: "somente_voce", deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] },
    });
    await say("dois");
    await say("três");
    const next = await continueInNewConversation(app.ctx, "u-ana");
    const previous = (await findConversation(app.ctx.db, conversation.id))!;
    expect(previous).toMatchObject({ state: "encerrada", outcome: "limite_atingido" });
    expect((await findDraft(app.ctx.db, draft.id))?.status).toBe("expirado");
    expect(next).toMatchObject({ state: "com_agent", agentMessageCount: 0, limitReached: false, previousConversationId: previous.id });
    expect(next.inheritedSummary).toContain("você estava abrindo um chamado sobre a VPN");
    expect(next.inheritedSummary).toContain(`Rascunho ${draft.displayCode} expirou`);
    const messages = await listMessages(app.ctx.db, next.id);
    expect(messages[0]).toMatchObject({ authorType: "sistema", eventType: "continuada" });
    expect(messages[0]!.parts.summary?.problem).toBe("você estava abrindo um chamado sobre a VPN");
    expect(messages[1]!.text).toMatch(/^Continuando: você estava abrindo um chamado sobre a VPN\./);
    expect(messages[1]!.text).toContain(`O rascunho ${draft.displayCode} expirou`);
    expect(app.eventsOf("conversation", "employee:u-ana").length).toBeGreaterThan(0);
  });

  it('"Continuar" antes do limite → 409', async () => {
    await say("um");
    await expect(continueInNewConversation(app.ctx, "u-ana")).rejects.toMatchObject({ status: 409 });
  });

  it('"Falar com um analista" no limite transfere normalmente', async () => {
    await say("um");
    await say("dois");
    await say("três");
    const transferred = await transferAtLimit(app.ctx, "u-ana");
    expect(transferred).toMatchObject({ state: "aguardando_atendente", transferReason: "limite" });
  });

  it("Confirmar de rascunho pendente continua funcionando no limite (não passa pelo agent)", async () => {
    await say("um");
    const conversation = await current();
    const { draft } = await proposeDraft(app.ctx, conversation, {
      kind: "novo",
      payload: { title: "VPN", description: "erro 809", type: "INC", category: "Rede e VPN", priority: "Alta", affected: "somente_voce", deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] },
    });
    await say("dois");
    await say("três");
    expect((await current()).limitReached).toBe(true);
    const ana = await app.user(ANA);
    const result = await confirmDraft(app.ctx, draft.id, ana);
    expect(result.ticket?.number).toMatch(/^INC-/);
    expect((await current()).agentMessageCount).toBe(3);
  });
});
