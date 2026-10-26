import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, createTestApp, type TestApp } from "@/test/harness";
import type { Summarizer } from "../agent/summarize";
import { listDecisions } from "../decisions/repo";
import { listMessages } from "../messages/repo";
import { findConversation, updateConversation } from "./repo";
import { getOrOpenConversation } from "./service";
import { contactTargetAt, transferConversation } from "./transfer";

let app: TestApp;
const calls: string[] = [];
const stub: Summarizer = {
  forTransfer: async (input) => {
    calls.push("forTransfer");
    return { problem: "Resumo gerado", done: `${input.messages.length} mensagens`, tickets: input.tickets, priority: null };
  },
  forContinuation: async () => ({ problem: "x", done: "", tickets: [] }),
};

beforeEach(async () => {
  calls.length = 0;
  app = await createTestApp({ summarizer: stub });
});
afterEach(() => app.close());

async function open() {
  const ana = await app.user(ANA);
  return (await getOrOpenConversation(app.ctx, ana.id)).conversation;
}

describe("transferência (FR-041)", () => {
  it("muda para aguardando atendente e grava motivo, resumo, confiança e horário", async () => {
    const conversation = await open();
    const summary = { problem: "VPN com erro 809", done: "Montou rascunho", tickets: [], priority: "Alta" };
    const result = await transferConversation(app.ctx, conversation.id, { reason: "baixa_confianca", summary, confidence: 41 });
    expect(result).toMatchObject({ state: "aguardando_atendente", transferReason: "baixa_confianca", transferConfidence: 41, transferredAt: app.clock.now.toISOString() });
    expect(result?.transferSummary).toMatchObject({ ...summary, reason: "baixa_confianca" });
    expect(calls).toEqual([]);
  });

  it("cria evento de sistema e mensagem ao funcionário com a expectativa de contato (2 h úteis)", async () => {
    const conversation = await open();
    await transferConversation(app.ctx, conversation.id, { reason: "pedido", summary: { problem: "p", done: "d", tickets: [] } });
    const messages = await listMessages(app.ctx.db, conversation.id);
    expect(messages.map((m) => [m.authorType, m.eventType ?? null])).toEqual([
      ["sistema", "transferida"],
      ["agent", null],
    ]);
    expect(messages[0]!.text).toBe("Transferida para o service desk · 10:00");
    expect(messages[1]!.text).toBe("Encaminhei para o service desk. Um analista fala com você em até 2 h úteis (até 12:00). Pode continuar escrevendo aqui: ele vê tudo.");
    const [decision] = await listDecisions(app.ctx.db, conversation.id);
    expect(decision).toMatchObject({ source: "template", action: "avisar_transferencia" });
    expect(decision!.steps[0]!.labels).toEqual(["transferiu para analista"]);
  });

  it("sem resumo, usa o resumidor; com chamado em foco registra o evento no chamado", async () => {
    const conversation = await open();
    await updateConversation(app.ctx.db, conversation.id, { focusTicket: "INC-20311", relatedTickets: ["INC-20311"] });
    const result = await transferConversation(app.ctx, conversation.id, { reason: "vencido" });
    expect(calls).toEqual(["forTransfer"]);
    expect(result?.transferSummary).toMatchObject({ problem: "Resumo gerado", tickets: ["INC-20311"] });
    const { events } = (await app.ctx.tickets.getWithEvents("INC-20311", {}))!;
    expect(events.at(-1)).toMatchObject({ kind: "transferido", text: "Transferido para um analista" });
  });

  it("publica 'state' para o chat e 'conversation_updated' para o console", async () => {
    const conversation = await open();
    await transferConversation(app.ctx, conversation.id, { reason: "pedido", summary: { problem: "p", done: "d", tickets: [] } });
    expect(app.eventsOf("state", `employee:${conversation.employeeId}`).at(-1)?.data).toMatchObject({ state: "aguardando_atendente" });
    expect(app.eventsOf("state", `conversation:${conversation.id}`)).toHaveLength(1);
    expect(app.eventsOf("conversation_updated", "console").length).toBeGreaterThan(0);
  });

  it("conversa que não está com o agent: nenhum efeito", async () => {
    const conversation = await open();
    await transferConversation(app.ctx, conversation.id, { reason: "pedido", summary: { problem: "p", done: "d", tickets: [] } });
    const before = (await listMessages(app.ctx.db, conversation.id)).length;
    expect(await transferConversation(app.ctx, conversation.id, { reason: "pedido" })).toBeNull();
    expect((await listMessages(app.ctx.db, conversation.id)).length).toBe(before);
    expect((await findConversation(app.ctx.db, conversation.id))?.transferReason).toBe("pedido");
  });

  it("alvo de contato: 2 horas úteis (sexta 17:00 → segunda 09:00)", () => {
    expect(contactTargetAt(new Date("2026-10-23T20:00:00Z")).toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });
});
