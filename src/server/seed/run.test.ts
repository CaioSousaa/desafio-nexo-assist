import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "@/test/harness";
import { listUsers } from "../auth/users";
import { listAllConversations } from "../conversations/repo";
import { findDecisionsByMessageIds } from "../decisions/repo";
import { listMessagesFor } from "../messages/repo";
import { canReopen } from "../rules/reopen-window";
import { isOverdue } from "../rules/sla";
import { seed } from "./run";
import { seedTickets } from "./tickets";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

describe("dados de exemplo (FR-101, FR-104)", () => {
  it("7 funcionários com departamento e dispositivo/SO; 2 analistas N1 e N2", async () => {
    const users = await listUsers(app.ctx.db);
    const employees = users.filter((u) => u.role === "funcionario");
    const analysts = users.filter((u) => u.role === "analista");
    expect(employees).toHaveLength(7);
    expect(employees.every((u) => u.department && u.deviceModel && u.deviceOs)).toBe(true);
    expect(analysts.map((a) => a.analystLevel).sort()).toEqual(["N1", "N2"]);
    expect(users.find((u) => u.email === "ana.souza@nexo.com.br")).toMatchObject({ name: "Ana Souza", deviceOs: "Windows 11" });
  });

  it("chamados do Anexo B nas situações pedidas", async () => {
    const get = async (n: string) => (await app.ctx.tickets.get(n, {}))!;
    const now = app.clock.now;
    const inc20311 = await get("INC-20311");
    expect(inc20311).toMatchObject({ status: "aguardando_analista", priority: "Média", requesterEmail: "ana.souza@nexo.com.br" });
    expect(isOverdue(inc20311, now)).toBe(true);
    expect((await get("INC-20298")).status).toBe("em_andamento");
    expect((await get("REQ-10442")).status).toBe("aprovado");
    const inc20150 = await get("INC-20150");
    expect(inc20150.status).toBe("resolvido");
    expect(canReopen(inc20150.resolvedAt!, now)).toBe(true);
    for (const old of ["INC-19877", "INC-19410"]) {
      const ticket = await get(old);
      expect(ticket.status).toBe("resolvido");
      expect(canReopen(ticket.resolvedAt!, now)).toBe(false);
    }
    expect((await app.ctx.tickets.listByRequester("diego.ramos@nexo.com.br")).map((t) => t.number)).toEqual(["INC-20519"]);
  });

  it("INC-20311 fica vencido e INC-20150 reabrível em qualquer dia/hora da semana da carga", () => {
    const base = new Date("2026-10-26T00:00:00Z").getTime();
    for (let hour = 0; hour < 7 * 24; hour += 5) {
      const now = new Date(base + hour * 3_600_000);
      const tickets = Object.fromEntries(seedTickets(now).map((s) => [s.ticket.number, s.ticket]));
      expect(isOverdue(tickets["INC-20311"]!, now), now.toISOString()).toBe(true);
      expect(canReopen(tickets["INC-20150"]!.resolvedAt!, now)).toBe(true);
      expect(isOverdue(tickets["INC-20298"]!, now)).toBe(false);
    }
  });

  it("Ana (conta de demonstração) começa sem conversa; 6 conversas prontas nos estados pedidos", async () => {
    const conversations = await listAllConversations(app.ctx.db);
    expect(conversations.some((c) => c.employeeId === "u-ana")).toBe(false);
    expect(conversations).toHaveLength(6);
    const states = conversations.map((c) => [c.state, c.transferReason ?? c.outcome ?? null]).map(String).sort();
    expect(states).toEqual(
      [
        ["aguardando_atendente", "pedido"],
        ["aguardando_atendente", "baixa_confianca"],
        ["com_agent", null],
        ["com_agent", null],
        ["encerrada", "resolvida_pelo_agent"],
        ["encerrada", "pedido"],
      ]
        .map(String)
        .sort(),
    );
    expect(conversations.find((c) => c.transferReason === "baixa_confianca")?.transferConfidence).toBe(41);
    expect(conversations.find((c) => c.employeeId === "u-gabriela")?.outcome).toBe("encerrada_pelo_analista");
  });

  it("toda mensagem do agent nas conversas prontas tem decisão completa com passos", async () => {
    const conversations = await listAllConversations(app.ctx.db);
    const messages = [...(await listMessagesFor(app.ctx.db, conversations.map((c) => c.id))).values()].flat();
    const agentMessages = messages.filter((m) => m.authorType === "agent");
    expect(agentMessages.length).toBeGreaterThan(8);
    const decisions = await findDecisionsByMessageIds(app.ctx.db, agentMessages.map((m) => m.id));
    for (const message of agentMessages) {
      const decision = decisions.get(message.id);
      expect(decision, message.text).toBeDefined();
      expect(decision!.steps.length).toBeGreaterThan(0);
      expect(decision!.steps.some((s) => s.visible)).toBe(true);
      expect(decision!.rationale.length).toBeGreaterThan(10);
      expect(decision!.understanding.intent).not.toBe("");
      expect(message.decisionId).toBe(decision!.id);
    }
  });

  it("rodar o seed de novo não duplica nada", async () => {
    const report = await seed({ db: app.ctx.db, tickets: app.ctx.ticketsLocal, now: app.clock.now });
    expect(report).toEqual({ users: 0, tickets: 0, conversations: 0 });
    expect(await listUsers(app.ctx.db)).toHaveLength(9);
    expect(await app.ctx.ticketsLocal.count()).toBe(11);
  });

  it("numeração de novos chamados continua depois dos de exemplo", async () => {
    const created = await app.ctx.tickets.create(
      { kind: "INC", title: "t", description: "d", category: "Outros", priority: "Baixa", affected: "somente_voce", requesterEmail: "ana.souza@nexo.com.br" },
      { idempotencyKey: "k" },
    );
    expect(Number(created.number.slice(4))).toBeGreaterThan(20519);
  });
});
