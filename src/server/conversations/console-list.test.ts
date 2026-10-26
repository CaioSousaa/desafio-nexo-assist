import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientId, createTestApp, RAFAEL, type TestApp } from "@/test/harness";
import { acceptEmployeeMessage } from "../agent/run-turn";
import { takeConversation } from "./console-actions";
import { consoleLabel, listForConsole } from "./console-list";
import { findConversation, updateConversation } from "./repo";
import { consoleSnapshot } from "./snapshot";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

const list = (filter: "todas" | "para_voce" | "com_agent" | "minhas" = "todas", q?: string, analyst = "u-rafael") =>
  listForConsole(app.ctx, analyst, { filter, q });

describe("lista do console", () => {
  it("rótulos por estado e motivo (FR-050)", async () => {
    const { items } = await list();
    const byName = Object.fromEntries(items.map((i) => [i.employee.name, i]));
    expect(byName["Carla Mendes"]!.label).toBe("Transferida · REQ-10451");
    expect(byName["Bruno Tavares"]!.label).toBe("Agent pediu ajuda · confiança 41%");
    expect(byName["Bruno Tavares"]!.confidence).toBe(41);
    expect(byName["Diego Ramos"]!.label).toBe("Agent atendendo");
    expect(byName["Elisa Prado"]!.label).toBe("Agent atendendo");
    expect(byName["Fábio Nunes"]!.label).toBe("Resolvida pelo agent");
    expect(byName["Gabriela Rocha"]!.label).toBe("Encerrada");
    expect(items.some((i) => i.employee.name === "Ana Souza")).toBe(false); // conta de demonstração começa sem conversa
  });

  it("contagens dos quatro filtros batem com as listas (FR-051)", async () => {
    const { counts } = await list();
    expect(counts).toEqual({ todas: 6, para_voce: 2, com_agent: 2, minhas: 0 });
    for (const filter of ["todas", "para_voce", "com_agent", "minhas"] as const) {
      expect((await list(filter)).items).toHaveLength(counts[filter]);
    }
  });

  it('"Para você" ordena da espera mais antiga para a mais recente', async () => {
    const { items } = await list("para_voce");
    expect(items.map((i) => i.employee.name)).toEqual(["Carla Mendes", "Bruno Tavares"]);
    expect(items[0]!.waitingSince! < items[1]!.waitingSince!).toBe(true);
  });

  it("busca por nome (sem acento/caixa) e por número de chamado (FR-052)", async () => {
    expect((await list("todas", "bruno")).items.map((i) => i.employee.name)).toEqual(["Bruno Tavares"]);
    expect((await list("todas", "FABIO")).items.map((i) => i.employee.name)).toEqual(["Fábio Nunes"]);
    expect((await list("todas", "REQ-10451")).items.map((i) => i.employee.name)).toEqual(["Carla Mendes"]);
    expect((await list("todas", "inc-20519")).items.map((i) => i.employee.name)).toEqual(["Diego Ramos"]);
    expect((await list("todas", "ninguém")).items).toEqual([]);
  });

  it("prévia da última mensagem com prefixo 'Nexo:' quando é do agent", async () => {
    const { items } = await list();
    const byName = Object.fromEntries(items.map((i) => [i.employee.name, i]));
    expect(byName["Carla Mendes"]!.preview).toBe("Preciso de acesso ao SAP ainda hoje");
    expect(byName["Bruno Tavares"]!.preview).toBe("Nexo: Vou chamar um analista para isso.");
    expect(byName["Elisa Prado"]!.preview).toMatch(/^Nexo: A senha do Wi-Fi é enviada/);
  });

  it("não lidas = mensagens do funcionário depois da última abertura pelo analista logado", async () => {
    const before = (await list()).items.find((i) => i.id === "seed-conv-carla")!;
    expect(before.unread).toBe(3);
    const rafael = await app.user(RAFAEL);
    await consoleSnapshot(app.ctx, rafael, "seed-conv-carla");
    expect((await list()).items.find((i) => i.id === "seed-conv-carla")!.unread).toBe(0);
    expect((await list("todas", undefined, "u-juliana")).items.find((i) => i.id === "seed-conv-carla")!.unread).toBe(3);
    app.clock.advance(60_000);
    const carla = await app.user("carla.mendes@nexo.com.br");
    await acceptEmployeeMessage(app.ctx, carla, { text: "Alguém aí?", clientMessageId: clientId() });
    expect((await list()).items.find((i) => i.id === "seed-conv-carla")!.unread).toBe(1);
  });

  it('"Você está atendendo" para quem assumiu e "Em atendimento por <nome>" para os demais; "Minhas" conta', async () => {
    const rafael = await app.user(RAFAEL);
    await takeConversation(app.ctx, rafael, "seed-conv-bruno");
    expect((await list("minhas")).items.map((i) => i.label)).toEqual(["Você está atendendo"]);
    expect((await list("todas", "bruno", "u-juliana")).items[0]!.label).toBe("Em atendimento por Rafael Lima");
    expect((await list()).counts).toMatchObject({ para_voce: 1, minhas: 1 });
  });

  it("'atrasada' após 2 h úteis de espera, sem devolução automática", async () => {
    expect((await list()).items.find((i) => i.id === "seed-conv-bruno")!.late).toBe(false);
    app.clock.advance(3 * 3_600_000);
    const bruno = (await list()).items.find((i) => i.id === "seed-conv-bruno")!;
    expect(bruno.late).toBe(true);
    expect((await findConversation(app.ctx.db, "seed-conv-bruno"))?.state).toBe("aguardando_atendente");
  });

  it("rótulo de transferência sem chamado mostra o tempo até o contato", async () => {
    const conversation = (await findConversation(app.ctx.db, "seed-conv-bruno"))!;
    const pedido = { ...conversation, transferReason: "pedido" as const, focusTicket: null };
    expect(consoleLabel(pedido, { analystId: "u-rafael", analystName: null, now: app.clock.now }).label).toBe("Transferida · contato em 1 h");
  });

  it("conversa encerrada por limite tem rótulo próprio", async () => {
    await updateConversation(app.ctx.db, "seed-conv-fabio", { outcome: "limite_atingido" });
    expect((await list("todas", "fabio")).items[0]!.label).toBe("Encerrada · limite de mensagens");
  });
});
