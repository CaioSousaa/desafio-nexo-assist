import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, BRUNO, clientId, createTestApp, JULIANA, RAFAEL, type TestApp } from "@/test/harness";
import { proposeDraft } from "../drafts/service";
import { findDraft } from "../drafts/repo";
import { listMessages } from "../messages/repo";
import { closeByAnalyst, returnToAgent, sendAnalystMessage, takeConversation } from "./console-actions";
import { findConversation } from "./repo";
import { getOrOpenConversation } from "./service";
import { transferConversation } from "./transfer";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

const BRUNO_CONV = "seed-conv-bruno"; // aguardando atendente (baixa confiança)
const CARLA_CONV = "seed-conv-carla"; // aguardando atendente, chamado em foco REQ-10451
const ELISA_CONV = "seed-conv-elisa"; // com o agent

describe("assumir atendimento (FR-055, FR-060)", () => {
  it("de aguardando atendente: atribui, pausa o agent, registra evento e anota o chamado em foco", async () => {
    const rafael = await app.user(RAFAEL);
    const taken = await takeConversation(app.ctx, rafael, CARLA_CONV);
    expect(taken).toMatchObject({ state: "com_analista", assignedAnalystId: rafael.id });
    const last = (await listMessages(app.ctx.db, CARLA_CONV)).at(-1)!;
    expect(last).toMatchObject({ authorType: "sistema", eventType: "assumida", text: "Rafael Lima assumiu · agent pausado · 10:00" });
    const ticket = (await app.ctx.tickets.getWithEvents("REQ-10451", {}))!;
    expect(ticket.ticket.status).toBe("em_atendimento");
    expect(ticket.events.at(-1)).toMatchObject({ kind: "assumido", text: "Assumido por Rafael Lima" });
    expect(app.eventsOf("state", `conversation:${CARLA_CONV}`).at(-1)?.data).toMatchObject({ state: "com_analista", analystName: "Rafael Lima" });
  });

  it("de uma conversa com o agent (não transferida) também pausa o agent", async () => {
    const rafael = await app.user(RAFAEL);
    expect((await takeConversation(app.ctx, rafael, ELISA_CONV)).state).toBe("com_analista");
  });

  it("dois analistas ao mesmo tempo: o primeiro vence, o segundo recebe already_assigned com o nome", async () => {
    const [rafael, juliana] = [await app.user(RAFAEL), await app.user(JULIANA)];
    const results = await Promise.allSettled([takeConversation(app.ctx, rafael, BRUNO_CONV), takeConversation(app.ctx, juliana, BRUNO_CONV)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const winner = (await findConversation(app.ctx.db, BRUNO_CONV))!.assignedAnalystId === rafael.id ? "Rafael Lima" : "Juliana Costa";
    expect(rejected[0]!.reason).toMatchObject({ status: 409, code: "already_assigned", message: `Em atendimento por ${winner}` });
    expect((await listMessages(app.ctx.db, BRUNO_CONV)).filter((m) => m.eventType === "assumida")).toHaveLength(1);
  });

  it("conversa encerrada não pode ser assumida", async () => {
    const rafael = await app.user(RAFAEL);
    await expect(takeConversation(app.ctx, rafael, "seed-conv-fabio")).rejects.toMatchObject({ code: "closed" });
  });
});

describe("devolver ao agent (FR-057)", () => {
  it("de aguardando atendente: volta ao agent com evento e mensagem de retomada citando o chamado", async () => {
    const rafael = await app.user(RAFAEL);
    const returned = await returnToAgent(app.ctx, rafael, CARLA_CONV);
    expect(returned).toMatchObject({ state: "com_agent", assignedAnalystId: null });
    const [event, resume] = (await listMessages(app.ctx.db, CARLA_CONV)).slice(-2);
    expect(event).toMatchObject({ eventType: "devolvida", text: "Nexo Assist voltou · 10:00" });
    expect(resume).toMatchObject({ authorType: "agent", text: "Voltei. Posso continuar ajudando com o REQ-10451?" });
    expect(resume!.decisionId).not.toBeNull();
  });

  it("assumida pelo próprio analista: devolve; sem chamado em foco a retomada é genérica", async () => {
    const rafael = await app.user(RAFAEL);
    await takeConversation(app.ctx, rafael, BRUNO_CONV);
    await returnToAgent(app.ctx, rafael, BRUNO_CONV);
    expect((await listMessages(app.ctx.db, BRUNO_CONV)).at(-1)?.text).toBe("Voltei. Posso continuar ajudando?");
  });

  it("assumida por outro analista: not_allowed", async () => {
    const [rafael, juliana] = [await app.user(RAFAEL), await app.user(JULIANA)];
    await takeConversation(app.ctx, rafael, BRUNO_CONV);
    await expect(returnToAgent(app.ctx, juliana, BRUNO_CONV)).rejects.toMatchObject({ status: 409, code: "not_allowed" });
  });

  it("com o agent (não transferida): not_allowed", async () => {
    const rafael = await app.user(RAFAEL);
    await expect(returnToAgent(app.ctx, rafael, ELISA_CONV)).rejects.toMatchObject({ code: "not_allowed" });
  });
});

describe("encerrar atendimento (FR-058)", () => {
  it("só o analista atribuído; encerra, registra evento, expira rascunho e anota o chamado", async () => {
    const [rafael, juliana] = [await app.user(RAFAEL), await app.user(JULIANA)];
    await takeConversation(app.ctx, rafael, CARLA_CONV);
    const conversation = (await findConversation(app.ctx.db, CARLA_CONV))!;
    const { draft } = await proposeDraft(app.ctx, conversation, {
      kind: "novo",
      payload: { title: "t", description: "d", type: "REQ", category: "Acesso", priority: "Baixa", affected: "somente_voce", deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] },
    });
    await expect(closeByAnalyst(app.ctx, juliana, CARLA_CONV)).rejects.toMatchObject({ code: "not_assigned_to_you" });
    const closed = await closeByAnalyst(app.ctx, rafael, CARLA_CONV);
    expect(closed).toMatchObject({ state: "encerrada", outcome: "encerrada_pelo_analista" });
    expect((await listMessages(app.ctx.db, CARLA_CONV)).at(-1)).toMatchObject({ eventType: "encerrada", text: "Atendimento encerrado · 10:00" });
    expect((await findDraft(app.ctx.db, draft.id))?.status).toBe("expirado");
    const { events, ticket } = (await app.ctx.tickets.getWithEvents("REQ-10451", {}))!;
    expect(events.at(-1)?.text).toBe("Atendimento encerrado por Rafael Lima");
    expect(ticket.status).toBe("em_atendimento"); // encerrar a conversa não muda o status do chamado
  });

  it("não encerra conversa aguardando (precisa assumir antes)", async () => {
    const rafael = await app.user(RAFAEL);
    await expect(closeByAnalyst(app.ctx, rafael, BRUNO_CONV)).rejects.toMatchObject({ code: "not_assigned_to_you" });
  });
});

describe("mensagem do analista (FR-056)", () => {
  it("só quem assumiu escreve; chega ao canal do funcionário com nome e nível", async () => {
    const [rafael, juliana] = [await app.user(RAFAEL), await app.user(JULIANA)];
    await expect(sendAnalystMessage(app.ctx, rafael, BRUNO_CONV, { text: "Oi", clientMessageId: clientId() })).rejects.toMatchObject({ status: 403 });
    await takeConversation(app.ctx, rafael, BRUNO_CONV);
    await expect(sendAnalystMessage(app.ctx, juliana, BRUNO_CONV, { text: "Oi", clientMessageId: clientId() })).rejects.toMatchObject({ code: "not_assigned_to_you" });
    const message = await sendAnalystMessage(app.ctx, rafael, BRUNO_CONV, { text: "Oi, Bruno! Qual sistema exatamente?", clientMessageId: clientId() });
    expect(message).toMatchObject({ authorType: "analista", authorId: rafael.id });
    const event = app.eventsOf("message", "employee:u-bruno").at(-1)!;
    expect(event.data).toMatchObject({ author: { name: "Rafael Lima", level: "N2" } });
  });

  it("mensagens do funcionário com analista não contam no limite e o agent fica em silêncio", async () => {
    const rafael = await app.user(RAFAEL);
    const bruno = await app.user(BRUNO);
    await takeConversation(app.ctx, rafael, BRUNO_CONV);
    const before = (await findConversation(app.ctx.db, BRUNO_CONV))!.agentMessageCount;
    const { acceptEmployeeMessage } = await import("../agent/run-turn");
    const accepted = await acceptEmployeeMessage(app.ctx, bruno, { text: "É o sistema da transportadora X", clientMessageId: clientId() });
    expect(accepted.run).toBeNull();
    expect((await findConversation(app.ctx.db, BRUNO_CONV))!.agentMessageCount).toBe(before);
  });
});

describe("ciclo completo", () => {
  it("transferir → assumir → responder → devolver → agent volta a responder", async () => {
    const ana = await app.user(ANA);
    const rafael = await app.user(RAFAEL);
    const { conversation } = await getOrOpenConversation(app.ctx, ana.id);
    await transferConversation(app.ctx, conversation.id, { reason: "pedido", summary: { problem: "p", done: "d", tickets: [] } });
    await takeConversation(app.ctx, rafael, conversation.id);
    await sendAnalystMessage(app.ctx, rafael, conversation.id, { text: "Oi Ana", clientMessageId: clientId() });
    await returnToAgent(app.ctx, rafael, conversation.id);
    expect((await findConversation(app.ctx.db, conversation.id))?.state).toBe("com_agent");
    const events = (await listMessages(app.ctx.db, conversation.id)).filter((m) => m.eventType).map((m) => m.eventType);
    expect(events).toEqual(["transferida", "assumida", "devolvida"]);
  });
});
