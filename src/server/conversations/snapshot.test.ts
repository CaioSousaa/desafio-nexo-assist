import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, clientId, createTestApp, RAFAEL, type TestApp } from "@/test/harness";
import { decision } from "@/test/scripted-model";
import { acceptEmployeeMessage } from "../agent/run-turn";
import { TicketServiceUnavailableError } from "../tickets/errors";
import { closeAsResolved, getOrOpenConversation } from "./service";
import { chatSnapshot, consoleSnapshot } from "./snapshot";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

describe("snapshot do chat (GET /api/chat)", () => {
  it("primeiro acesso da Ana: nenhuma conversa, contador 0/30", async () => {
    const snapshot = await chatSnapshot(app.ctx, await app.user(ANA));
    expect(snapshot).toMatchObject({ conversations: [], currentId: null, counter: { used: 0, limit: 30 }, state: null });
  });

  it("conversas anteriores encerradas aparecem antes da atual, com mensagens, decisões e rascunhos", async () => {
    const ana = await app.user(ANA);
    const first = (await getOrOpenConversation(app.ctx, ana.id)).conversation;
    await closeAsResolved(app.ctx, first.id);
    app.clock.advance(60_000);
    app.model.push({ tools: [decision()] }, { text: "Oi!" });
    const accepted = await acceptEmployeeMessage(app.ctx, ana, { text: "oi", clientMessageId: clientId() });
    await accepted.run?.();
    const snapshot = await chatSnapshot(app.ctx, ana);
    expect(snapshot.conversations.map((c) => c.conversation.id)).toEqual([first.id, accepted.conversation.id]);
    expect(snapshot.currentId).toBe(accepted.conversation.id);
    expect(snapshot.counter).toEqual({ used: 1, limit: 30 });
    const reply = snapshot.conversations[1]!.messages.find((m) => m.authorType === "agent")!;
    expect(reply.decision?.action).toBe("responder_central");
  });

  it("não expõe o resumo da transferência nem a confiança ao funcionário", async () => {
    const carla = await app.user("carla.mendes@nexo.com.br");
    const snapshot = await chatSnapshot(app.ctx, carla);
    const json = JSON.stringify(snapshot.conversations[0]!.conversation);
    expect(json).not.toContain("transferSummary");
    expect(json).not.toContain("transferConfidence");
    expect(snapshot.state).toBe("aguardando_atendente");
  });

  it("mostra o nome do analista que está atendendo", async () => {
    const gabriela = await app.user("gabriela.rocha@nexo.com.br");
    const snapshot = await chatSnapshot(app.ctx, gabriela);
    const analystMessage = snapshot.conversations[0]!.messages.find((m) => m.authorType === "analista")!;
    expect(analystMessage.author).toEqual({ name: "Rafael Lima", level: "N2" });
  });
});

describe("snapshot do console", () => {
  it("traz funcionário, resumo da transferência, painel de chamados e marca como lida", async () => {
    const rafael = await app.user(RAFAEL);
    const snapshot = await consoleSnapshot(app.ctx, rafael, "seed-conv-bruno");
    expect(snapshot.employee.name).toBe("Bruno Tavares");
    expect(snapshot.transfer).toMatchObject({ reason: "baixa_confianca", confidence: 41, late: false });
    expect(snapshot.transfer.summary?.problem).toContain("sistema da transportadora");
    expect(snapshot.transfer.contactTargetAt).not.toBeNull();
    expect(snapshot.messages.every((m) => m.authorType !== "agent" || m.decision !== null)).toBe(true);
    expect(snapshot.tickets.ok).toBe(true);
    if (snapshot.tickets.ok) {
      expect(snapshot.tickets.ofConversation).toEqual([]);
      expect(snapshot.tickets.others.map((t) => t.ticket.number)).toEqual(["INC-20102"]);
      expect(snapshot.tickets.counts).toEqual({ open: 0, closed: 1 });
    }
  });

  it("painel separa chamados desta conversa (com último evento) dos demais", async () => {
    const rafael = await app.user(RAFAEL);
    const snapshot = await consoleSnapshot(app.ctx, rafael, "seed-conv-carla");
    if (!snapshot.tickets.ok) throw new Error("painel deveria carregar");
    expect(snapshot.tickets.ofConversation.map((t) => t.ticket.number)).toEqual(["REQ-10451"]);
    expect(snapshot.tickets.ofConversation[0]!.lastEvent?.kind).toBe("criado");
  });

  it("vencido no painel usa o mesmo cálculo do chat (FR-103)", async () => {
    const rafael = await app.user(RAFAEL);
    const ana = await app.user(ANA);
    const { conversation } = await getOrOpenConversation(app.ctx, ana.id);
    const snapshot = await consoleSnapshot(app.ctx, rafael, conversation.id);
    if (!snapshot.tickets.ok) throw new Error("painel deveria carregar");
    const overdue = Object.fromEntries(snapshot.tickets.others.map((t) => [t.ticket.number, t.overdue]));
    expect(overdue).toMatchObject({ "INC-20311": true, "INC-20298": false, "REQ-10442": false, "INC-20150": false });
    expect(snapshot.tickets.counts).toEqual({ open: 3, closed: 3 });
  });

  it("serviço de chamados fora do ar: painel indica indisponível e o resto carrega", async () => {
    app.ctx.ticketsLocal.outageSimulator.check = () => {
      throw new TicketServiceUnavailableError();
    };
    const rafael = await app.user(RAFAEL);
    const snapshot = await consoleSnapshot(app.ctx, rafael, "seed-conv-carla");
    expect(snapshot.tickets).toEqual({ ok: false, error: "tickets_unavailable", message: "Serviço de chamados indisponível" });
    expect(snapshot.messages.length).toBeGreaterThan(0);
  });

  it("conversa inexistente → 404", async () => {
    const rafael = await app.user(RAFAEL);
    await expect(consoleSnapshot(app.ctx, rafael, "nao-existe")).rejects.toMatchObject({ status: 404 });
  });
});
