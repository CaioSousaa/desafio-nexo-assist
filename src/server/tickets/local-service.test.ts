import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tempDir } from "@/test/tmp";
import { TicketServiceUnavailableError } from "./errors";
import { LocalTicketService } from "./local-service";
import type { CreateTicketInput } from "./types";

const ana = "ana.souza@nexo.com.br";
const bruno = "bruno.tavares@nexo.com.br";

const vpn: CreateTicketInput = {
  kind: "INC",
  title: "VPN não conecta (erro 809)",
  description: "Notebook Windows 11 não conecta na VPN desde ontem.",
  category: "Rede e VPN",
  priority: "Alta",
  affected: "somente_voce",
  requesterEmail: ana,
};

const opened: LocalTicketService[] = [];
async function open(options: Parameters<typeof LocalTicketService.open>[1] = {}) {
  const service = await LocalTicketService.open(join(tempDir(), "tickets.db"), options);
  opened.push(service);
  return service;
}
afterEach(() => {
  for (const s of opened.splice(0)) s.close();
});

describe("LocalTicketService", () => {
  it("numera INC e REQ em sequência própria", async () => {
    const service = await open();
    const a = await service.create(vpn, { idempotencyKey: "k1" });
    const b = await service.create(vpn, { idempotencyKey: "k2" });
    const r = await service.create({ ...vpn, kind: "REQ", category: "Hardware", priority: "Baixa" }, { idempotencyKey: "k3" });
    expect(a.number).toMatch(/^INC-\d{5}$/);
    expect(Number(b.number.slice(4))).toBe(Number(a.number.slice(4)) + 1);
    expect(r.number).toMatch(/^REQ-\d{5}$/);
    expect(a.status).toBe("aberto");
  });

  it("guarda os seis campos obrigatórios e o histórico de criação", async () => {
    const service = await open();
    const created = await service.create(vpn, { idempotencyKey: "k1" });
    const full = await service.getWithEvents(created.number, { requesterEmail: ana });
    expect(full?.ticket).toMatchObject({
      title: vpn.title,
      description: vpn.description,
      kind: "INC",
      category: "Rede e VPN",
      priority: "Alta",
      affected: "somente_voce",
    });
    expect(full?.events.map((e) => e.kind)).toEqual(["criado"]);
  });

  it("mesma chave de idempotência devolve o mesmo chamado sem duplicar", async () => {
    const service = await open();
    const first = await service.create(vpn, { idempotencyKey: "draft-1" });
    const again = await service.create(vpn, { idempotencyKey: "draft-1" });
    expect(again.number).toBe(first.number);
    expect(await service.count()).toBe(1);
  });

  it("criações concorrentes com a mesma chave geram um chamado só", async () => {
    const service = await open();
    const results = await Promise.all([
      service.create(vpn, { idempotencyKey: "same" }),
      service.create(vpn, { idempotencyKey: "same" }),
      service.create(vpn, { idempotencyKey: "same" }),
    ]);
    expect(new Set(results.map((t) => t.number)).size).toBe(1);
    expect(await service.count()).toBe(1);
  });

  it("listByRequester não devolve chamado de outro e-mail (privacidade)", async () => {
    const service = await open();
    await service.create(vpn, { idempotencyKey: "a" });
    await service.create({ ...vpn, requesterEmail: bruno }, { idempotencyKey: "b" });
    const mine = await service.listByRequester(ana);
    expect(mine).toHaveLength(1);
    expect(mine.every((t) => t.requesterEmail === ana)).toBe(true);
  });

  it("get com requesterEmail de outro funcionário devolve null, sem vazar o chamado", async () => {
    const service = await open();
    const brunos = await service.create({ ...vpn, requesterEmail: bruno }, { idempotencyKey: "b" });
    expect(await service.get(brunos.number, { requesterEmail: ana })).toBeNull();
    expect(await service.getWithEvents(brunos.number, { requesterEmail: ana })).toBeNull();
    expect((await service.get(brunos.number, {}))?.number).toBe(brunos.number);
  });

  it("aceita número em minúsculas e inexistente devolve null", async () => {
    const service = await open();
    const created = await service.create(vpn, { idempotencyKey: "a" });
    expect((await service.get(created.number.toLowerCase(), { requesterEmail: ana }))?.number).toBe(created.number);
    expect(await service.get("INC-99999", { requesterEmail: ana })).toBeNull();
  });

  it("addNote registra nota 'via Nexo Assist' e muda a prioridade quando pedido", async () => {
    const service = await open();
    const created = await service.create({ ...vpn, priority: "Média" }, { idempotencyKey: "a" });
    const updated = await service.addNote(
      created.number,
      { text: "Agora nem liga.", author: "via Nexo Assist", newPriority: "Alta" },
      { idempotencyKey: "note-1" },
    );
    expect(updated.priority).toBe("Alta");
    const { events } = (await service.getWithEvents(created.number, {}))!;
    expect(events.map((e) => [e.kind, e.author])).toEqual([
      ["criado", "via Nexo Assist"],
      ["nota", "via Nexo Assist"],
      ["prioridade", "via Nexo Assist"],
    ]);
    // repetir a confirmação não duplica a nota
    await service.addNote(created.number, { text: "Agora nem liga.", author: "via Nexo Assist" }, { idempotencyKey: "note-1" });
    expect((await service.getWithEvents(created.number, {}))!.events).toHaveLength(3);
  });

  it("addNote sem mudança de prioridade não gera evento de prioridade", async () => {
    const service = await open();
    const created = await service.create(vpn, { idempotencyKey: "a" });
    await service.addNote(created.number, { text: "Mais detalhes", author: "via Nexo Assist", newPriority: "Alta" }, { idempotencyKey: "n" });
    const { events } = (await service.getWithEvents(created.number, {}))!;
    expect(events.map((e) => e.kind)).toEqual(["criado", "nota"]);
  });

  it("reopen volta a 'aberto' com evento 'reaberto'; não reabre o que não está resolvido", async () => {
    const service = await open();
    const created = await service.create(vpn, { idempotencyKey: "a" });
    await expect(
      service.reopen(created.number, { text: "Voltou", author: "via Nexo Assist" }, { idempotencyKey: "r0" }),
    ).rejects.toThrow(/não está resolvido/);
    await service.setStatus(created.number, "resolvido", { text: "Resolvido", author: "Rafael Lima" });
    const reopened = await service.reopen(created.number, { text: "Voltou a acontecer", author: "via Nexo Assist" }, { idempotencyKey: "r1" });
    expect(reopened.status).toBe("aberto");
    expect(reopened.resolvedAt).toBeNull();
    const { events } = (await service.getWithEvents(created.number, {}))!;
    expect(events.at(-1)?.kind).toBe("reaberto");
  });

  it("registerTransfer e setStatus('em_atendimento') geram eventos", async () => {
    const service = await open();
    const created = await service.create(vpn, { idempotencyKey: "a" });
    await service.registerTransfer(created.number, { conversationId: "c1", reason: "pedido", author: "Nexo Assist" });
    const taken = await service.setStatus(created.number, "em_atendimento", {
      text: "Assumido por Rafael Lima",
      author: "Rafael Lima",
      eventKind: "assumido",
    });
    expect(taken.status).toBe("em_atendimento");
    const { events } = (await service.getWithEvents(created.number, {}))!;
    expect(events.map((e) => [e.kind, e.text])).toEqual([
      ["criado", expect.any(String)],
      ["transferido", "Transferido para um analista"],
      ["assumido", "Assumido por Rafael Lima"],
    ]);
  });

  it("listByRequester com resolvedSince traz abertos e resolvidos recentes", async () => {
    let now = new Date("2026-10-01T12:00:00Z");
    const service = await open({ now: () => now });
    const old = await service.create(vpn, { idempotencyKey: "old" });
    await service.setStatus(old.number, "resolvido", { text: "ok", author: "x" });
    now = new Date("2026-10-20T12:00:00Z");
    const recent = await service.create(vpn, { idempotencyKey: "recent" });
    await service.setStatus(recent.number, "resolvido", { text: "ok", author: "x" });
    const open1 = await service.create(vpn, { idempotencyKey: "open" });
    const list = await service.listByRequester(ana, { resolvedSince: new Date("2026-10-10T00:00:00Z") });
    expect(list.map((t) => t.number).sort()).toEqual([recent.number, open1.number].sort());
    expect(await service.listByRequester(ana)).toHaveLength(3);
  });

  it("seed respeita números de exemplo e a numeração continua depois deles", async () => {
    const service = await open();
    const at = "2026-10-20T12:00:00.000Z";
    const inserted = await service.seed([
      {
        ticket: { number: "INC-20600", kind: "INC", title: "t", description: "d", category: "Outros", priority: "Baixa", affected: "somente_voce", requesterEmail: ana, status: "aberto", createdAt: at, updatedAt: at, resolvedAt: null },
        events: [{ kind: "criado", text: "c", author: "x", createdAt: at }],
      },
    ]);
    expect(inserted).toBe(1);
    expect(await service.seed([])).toBe(0);
    const next = await service.create(vpn, { idempotencyKey: "n" });
    expect(next.number).toBe("INC-20601");
  });

  describe("indisponibilidade simulada", () => {
    it("com taxa 1 toda operação lança TicketServiceUnavailableError durante a janela", async () => {
      let clock = 1_000_000;
      const service = await open({ outage: { rate: 1, seconds: 4, now: () => clock } });
      await expect(service.listByRequester(ana)).rejects.toBeInstanceOf(TicketServiceUnavailableError);
      expect(service.outageSimulator.isDown()).toBe(true);
      clock += 3_000;
      await expect(service.get("INC-1", {})).rejects.toBeInstanceOf(TicketServiceUnavailableError);
      clock += 2_000;
      expect(service.outageSimulator.isDown()).toBe(false);
    });

    it("janela dura TICKETS_OUTAGE_SECONDS e depois o serviço volta (taxa baixa)", async () => {
      let clock = 0;
      const rolls = [0.05, 0.9, 0.9];
      const service = await open({ outage: { rate: 0.1, seconds: 4, now: () => clock, random: () => rolls.shift() ?? 0.9 } });
      await expect(service.listByRequester(ana)).rejects.toBeInstanceOf(TicketServiceUnavailableError);
      clock = 3_999;
      await expect(service.listByRequester(ana)).rejects.toBeInstanceOf(TicketServiceUnavailableError);
      clock = 4_000;
      await expect(service.listByRequester(ana)).resolves.toEqual([]);
    });

    it("com taxa 0 nunca falha", async () => {
      const service = await open({ outage: { rate: 0, seconds: 4, random: () => 0 } });
      for (let i = 0; i < 20; i++) await service.listByRequester(ana);
      expect(service.outageSimulator.isDown()).toBe(false);
    });
  });
});
