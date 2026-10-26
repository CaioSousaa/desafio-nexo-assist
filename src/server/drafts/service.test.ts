import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, BRUNO, createTestApp, type TestApp } from "@/test/harness";
import { getOrOpenConversation } from "../conversations/service";
import { findConversation, updateConversation, type Conversation } from "../conversations/repo";
import { listDecisions } from "../decisions/repo";
import { listMessages } from "../messages/repo";
import { TicketServiceUnavailableError } from "../tickets/errors";
import { findDraft, findPendingDraft, transitionDraft, type DraftPayload } from "./repo";
import { cancelDraft, confirmDraft, expirePendingDraft, proposeDraft, TICKETS_UNAVAILABLE_MESSAGE } from "./service";

let app: TestApp;
let conversation: Conversation;
let ana: { id: string; email: string };

beforeEach(async () => {
  app = await createTestApp();
  ana = await app.user(ANA);
  conversation = (await getOrOpenConversation(app.ctx, ana.id)).conversation;
});
afterEach(() => app.close());

const payload = (overrides: Partial<DraftPayload> = {}): DraftPayload => ({
  title: "VPN não conecta (erro 809)",
  description: "Notebook Windows 11 não conecta na VPN; erro 809.",
  type: "INC",
  category: "Rede e VPN",
  priority: "Alta",
  affected: "somente_voce",
  deadlineAt: new Date("2026-10-26T17:00:00Z").toISOString(),
  rule: "Afeta só você, com compromisso no mesmo dia: prioridade Alta (4 horas úteis).",
  assumptions: [],
  ...overrides,
});

async function makeCritical() {
  const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload({ priority: "Crítica", affected: "equipe", title: "Rede do andar caiu" }) });
  await transitionDraft(app.ctx.db, draft.id, ["aguardando_confirmacao"], { transferAfterDecision: true });
  await updateConversation(app.ctx.db, conversation.id, {
    pendingTransfer: true,
    transferReason: "critico",
    transferSummary: { problem: "Rede do 3º andar caiu", done: "Montou o rascunho crítico", tickets: [], priority: "Crítica" },
  });
  return draft;
}

describe("rascunhos", () => {
  it("propose devolve D-### sequencial e substitui o pendente (FR-025)", async () => {
    const a = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const b = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload({ category: "Software" }) });
    expect(a.draft.displayCode).toMatch(/^D-\d+$/);
    expect(Number(b.draft.displayCode.slice(2))).toBe(Number(a.draft.displayCode.slice(2)) + 1);
    expect(b.replaced?.id).toBe(a.draft.id);
    expect((await findDraft(app.ctx.db, a.draft.id))?.status).toBe("substituido");
    expect((await findPendingDraft(app.ctx.db, conversation.id))?.id).toBe(b.draft.id);
  });

  it("nada é gravado no serviço de chamados antes de Confirmar (SC-002)", async () => {
    const before = await app.ctx.ticketsLocal.count();
    await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    expect(await app.ctx.ticketsLocal.count()).toBe(before);
  });

  it("Confirmar cria o chamado com os seis campos, grava resulting_ticket e responde por template", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const result = await confirmDraft(app.ctx, draft.id, ana);
    expect(result.ticket).toMatchObject({
      number: expect.stringMatching(/^INC-\d{5}$/),
      title: "VPN não conecta (erro 809)",
      description: expect.any(String),
      kind: "INC",
      category: "Rede e VPN",
      priority: "Alta",
      affected: "somente_voce",
      requesterEmail: ANA,
      status: "aberto",
    });
    expect(result.draft).toMatchObject({ status: "confirmado", resultingTicket: result.ticket!.number });
    expect(result.message.text).toBe(`Pronto: abri o chamado ${result.ticket!.number} com prioridade Alta. Primeira resposta até 14:00.`);
    const decisions = await listDecisions(app.ctx.db, conversation.id);
    expect(decisions.at(-1)).toMatchObject({ source: "template", confidence: 100, action: "registrar_chamado" });
    expect(decisions.at(-1)?.steps[0]?.labels).toEqual(["criou o chamado"]);
    expect((await findConversation(app.ctx.db, conversation.id))?.focusTicket).toBe(result.ticket!.number);
  });

  it("Confirmar repetido não cria um segundo chamado (409 not_pending)", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    await confirmDraft(app.ctx, draft.id, ana);
    const before = await app.ctx.ticketsLocal.count();
    await expect(confirmDraft(app.ctx, draft.id, ana)).rejects.toMatchObject({ status: 409, code: "not_pending" });
    expect(await app.ctx.ticketsLocal.count()).toBe(before);
  });

  it("Confirmar concorrente: só um vence e existe um único chamado", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const before = await app.ctx.ticketsLocal.count();
    const results = await Promise.allSettled([confirmDraft(app.ctx, draft.id, ana), confirmDraft(app.ctx, draft.id, ana), confirmDraft(app.ctx, draft.id, ana)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await app.ctx.ticketsLocal.count()).toBe(before + 1);
    const agentMessages = (await listMessages(app.ctx.db, conversation.id)).filter((m) => m.authorType === "agent");
    expect(agentMessages).toHaveLength(1);
  });

  it("serviço fora do ar após as tentativas: rascunho continua pendente, 503, e Confirmar depois funciona sem duplicar (FR-026)", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const original = app.ctx.ticketsLocal.outageSimulator.check.bind(app.ctx.ticketsLocal.outageSimulator);
    app.ctx.ticketsLocal.outageSimulator.check = () => {
      throw new TicketServiceUnavailableError();
    };
    const before = await app.ctx.ticketsLocal.count();
    await expect(confirmDraft(app.ctx, draft.id, ana)).rejects.toMatchObject({ status: 503, code: "tickets_unavailable", extra: { attempts: 4 } });
    const kept = await findDraft(app.ctx.db, draft.id);
    expect(kept).toMatchObject({ status: "aguardando_confirmacao", lastError: TICKETS_UNAVAILABLE_MESSAGE });
    expect(await app.ctx.ticketsLocal.count()).toBe(before);
    expect((await listMessages(app.ctx.db, conversation.id)).some((m) => m.text.startsWith("Pronto"))).toBe(false);

    app.ctx.ticketsLocal.outageSimulator.check = original;
    const ok = await confirmDraft(app.ctx, draft.id, ana);
    expect(ok.draft.status).toBe("confirmado");
    expect(await app.ctx.ticketsLocal.count()).toBe(before + 1);
  });

  it("Cancelar descarta sem gravar e confirma com template", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const before = await app.ctx.ticketsLocal.count();
    const result = await cancelDraft(app.ctx, draft.id, ana);
    expect(result.draft.status).toBe("cancelado");
    expect(result.message.text).toBe(`Rascunho ${draft.displayCode} cancelado. Nada foi criado. Se quiser, me conte o que mudou e eu monto outro.`);
    expect(await app.ctx.ticketsLocal.count()).toBe(before);
    await expect(cancelDraft(app.ctx, draft.id, ana)).rejects.toMatchObject({ code: "not_pending" });
    await expect(confirmDraft(app.ctx, draft.id, ana)).rejects.toMatchObject({ code: "not_pending" });
  });

  it("rascunho de outro funcionário é 404 (não confirma nem cancela)", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    const bruno = await app.user(BRUNO);
    await expect(confirmDraft(app.ctx, draft.id, bruno)).rejects.toMatchObject({ status: 404 });
    await expect(cancelDraft(app.ctx, draft.id, bruno)).rejects.toMatchObject({ status: 404 });
  });

  it("crítico: Confirmar cria o chamado e transfere em seguida com o número no resumo (FR-044)", async () => {
    const draft = await makeCritical();
    const result = await confirmDraft(app.ctx, draft.id, ana);
    const fresh = await findConversation(app.ctx.db, conversation.id);
    expect(fresh).toMatchObject({ state: "aguardando_atendente", transferReason: "critico", pendingTransfer: false, focusTicket: result.ticket!.number });
    expect(fresh?.transferSummary?.tickets).toContain(result.ticket!.number);
    expect(fresh?.transferSummary?.done).toContain(`Chamado ${result.ticket!.number} criado`);
    const texts = (await listMessages(app.ctx.db, conversation.id)).map((m) => m.eventType ?? m.text);
    expect(texts.indexOf("transferida")).toBeGreaterThan(texts.findIndex((t) => t.startsWith("Pronto")));
  });

  it("crítico: Cancelar não cria chamado, mas transfere com 'não confirmou' (D5)", async () => {
    const draft = await makeCritical();
    const before = await app.ctx.ticketsLocal.count();
    const result = await cancelDraft(app.ctx, draft.id, ana);
    expect(await app.ctx.ticketsLocal.count()).toBe(before);
    expect(result.message.text).toContain("vou passar a conversa para um analista mesmo assim");
    const fresh = await findConversation(app.ctx.db, conversation.id);
    expect(fresh?.state).toBe("aguardando_atendente");
    expect(fresh?.transferSummary).toMatchObject({ notConfirmed: true });
    expect(fresh?.transferSummary?.done).toContain("não confirmou o chamado");
  });

  it("atualização chama addNote com autor 'via Nexo Assist'; nova prioridade gera evento 'prioridade'", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, {
      kind: "atualizacao",
      payload: payload({ title: "Notebook lento após atualização", category: "Hardware", priority: "Média", targetTicket: "INC-20311", note: "Piorou, agora nem liga.", newPriority: "Alta" }),
    });
    const result = await confirmDraft(app.ctx, draft.id, ana);
    expect(result.ticket?.number).toBe("INC-20311");
    expect(result.ticket?.priority).toBe("Alta");
    const { events } = (await app.ctx.tickets.getWithEvents("INC-20311", {}))!;
    expect(events.slice(-2).map((e) => [e.kind, e.author])).toEqual([
      ["nota", "via Nexo Assist"],
      ["prioridade", "via Nexo Assist"],
    ]);
    expect(events.at(-2)?.text).toBe("Piorou, agora nem liga.");
    expect(result.message.text).toContain("a prioridade passou para Alta");
  });

  it("reabertura chama reopen e o chamado volta a 'aberto'", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, {
      kind: "reabertura",
      payload: payload({ title: "Senha do SAP bloqueada", category: "Acesso", targetTicket: "INC-20150", note: "A senha do SAP bloqueou de novo." }),
    });
    const result = await confirmDraft(app.ctx, draft.id, ana);
    expect(result.ticket).toMatchObject({ number: "INC-20150", status: "aberto", resolvedAt: null });
    expect(result.message.text).toContain("Reabri o INC-20150");
  });

  it("expirePendingDraft marca 'expirado'", async () => {
    const { draft } = await proposeDraft(app.ctx, conversation, { kind: "novo", payload: payload() });
    expect((await expirePendingDraft(app.ctx, conversation))?.status).toBe("expirado");
    expect((await findDraft(app.ctx.db, draft.id))?.status).toBe("expirado");
    expect(await expirePendingDraft(app.ctx, conversation)).toBeNull();
  });
});
