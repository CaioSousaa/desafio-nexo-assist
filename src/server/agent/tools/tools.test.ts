import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, createTestApp, type TestApp } from "@/test/harness";
import { getOrOpenConversation } from "../../conversations/service";
import { findDraft, findPendingDraft } from "../../drafts/repo";
import { classifyPriority } from "../../rules/priority";
import { TicketServiceUnavailableError } from "../../tickets/errors";
import { deadlineFor } from "../../rules/sla";
import { createRequestContext, createTurnScratch, type TurnContext } from "./context";
import { nexoTools } from "./index";

let app: TestApp;
let turn: TurnContext;

beforeEach(async () => {
  app = await createTestApp();
  const ana = await app.user(ANA);
  const { conversation } = await getOrOpenConversation(app.ctx, ana.id);
  turn = { app: app.ctx, employee: ana, conversation, pendingDraft: null, scratch: createTurnScratch() };
});
afterEach(() => app.close());

type ToolName = keyof typeof nexoTools;
async function run(name: ToolName, input: Record<string, unknown>): Promise<Record<string, any>> {
  const tool = nexoTools[name] as unknown as { execute: (input: unknown, ctx: unknown) => Promise<Record<string, any>> };
  return tool.execute(input, { requestContext: createRequestContext(turn) });
}

const vpnDraft = {
  kind: "novo",
  title: "VPN não conecta (erro 809)",
  description: "Notebook Windows 11 não conecta na VPN; erro 809.",
  type: "INC",
  category: "Rede e VPN",
  affected: "somente_voce",
  classification: { blocksWork: true, sameDayCommitment: true, hasWorkaround: false },
  duplicateCheck: { considered: ["INC-20311"], verdict: "diferente", why: "Não é VPN." },
};

describe("ferramentas do agent", () => {
  it("nenhuma ferramenta recebe solicitante como parâmetro: identidade só pelo requestContext (FR-003)", () => {
    for (const [name, tool] of Object.entries(nexoTools)) {
      const shape = (tool.inputSchema as unknown as { shape?: Record<string, unknown> }).shape ?? {};
      const keys = Object.keys(shape).join(",");
      expect(keys, name).not.toMatch(/email|employee|requester|user/i);
    }
  });

  it("list_my_tickets devolve só os chamados do funcionário do turno, com vencido e reabertura", async () => {
    const result = await run("list_my_tickets", {});
    const numbers = result.tickets.map((t: { number: string }) => t.number);
    expect(numbers).toEqual(expect.arrayContaining(["INC-20311", "INC-20298", "REQ-10442", "INC-20150"]));
    expect(numbers).not.toContain("INC-20519"); // do Diego
    expect(numbers).not.toContain("INC-19877"); // resolvido há > 30 dias
    const byNumber = Object.fromEntries(result.tickets.map((t: { number: string }) => [t.number, t]));
    expect(byNumber["INC-20311"].overdue).toBe(true);
    expect(byNumber["INC-20298"].overdue).toBe(false);
    expect(byNumber["INC-20150"].canReopen).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("get_ticket de outro funcionário → found:false, sem nenhum dado do chamado", async () => {
    const result = await run("get_ticket", { number: "INC-20519" });
    expect(result).toEqual({ found: false, message: "Não encontrei esse chamado entre os seus.", attempts: 1 });
    expect(turn.scratch.tickets.has("INC-20519")).toBe(false);
  });

  it("get_ticket do próprio funcionário traz prazo vencido e histórico, e vira chamado em foco", async () => {
    const result = await run("get_ticket", { number: "inc-20311" });
    expect(result.found).toBe(true);
    expect(result.ticket.number).toBe("INC-20311");
    expect(result.sla.overdue).toBe(true);
    expect(result.sla.ruleText).toBe("Média: 3 dias úteis");
    expect(result.recentEvents.length).toBeGreaterThan(0);
    expect(turn.scratch.focusTicket).toBe("INC-20311");
  });

  it("show_ticket_card usa o cache do turno e monta o card; número alheio não mostra nada", async () => {
    await run("get_ticket", { number: "INC-20311" });
    expect(await run("show_ticket_card", { number: "INC-20311" })).toEqual({ shown: true, overdue: true });
    expect(turn.scratch.ticketCard).toMatchObject({ number: "INC-20311", category: "Hardware", priority: "Média", overdue: true });
    expect(turn.scratch.ticketCard?.lastUpdateText).toBe("há 6 dias");
    expect((await run("show_ticket_card", { number: "INC-20519" })).shown).toBe(false);
  });

  it("offer_ticket_selection ignora chamados que não são do funcionário", async () => {
    const result = await run("offer_ticket_selection", { numbers: ["INC-20311", "INC-20519", "REQ-10442"] });
    expect(result).toEqual({ shown: 2, skipped: 1 });
    expect(turn.scratch.ticketList?.map((t) => t.number)).toEqual(["INC-20311", "REQ-10442"]);
  });

  it("search_help_center compara a condição do artigo com o SO do funcionário (Windows 11)", async () => {
    const result = await run("search_help_center", { query: "erro 809 na VPN" });
    const article = result.articles.find((a: { id: string }) => a.id === "vpn-erro-809");
    expect(article.appliesToEmployee).toBe(false);
    expect(result.employeeDevice).toContain("Windows 11");
  });

  it("classify_priority devolve prioridade e prazo iguais às regras", async () => {
    const input = { kind: "INC", impact: "somente_voce", blocksWork: true, sameDayCommitment: true, hasWorkaround: false } as const;
    const result = await run("classify_priority", input);
    const expected = classifyPriority(input);
    expect(result.priority).toBe(expected.priority);
    expect(result.deadlineAt).toBe(deadlineFor(expected.priority, app.clock.now).toISOString());
    expect(result.deadlineText).toBe("resposta até 14:00");
  });

  it("propose_draft calcula a prioridade no servidor e ignora prioridade enviada pelo modelo", async () => {
    const result = await run("propose_draft", { ...vpnDraft, priority: "Crítica" });
    expect(result.ok).toBe(true);
    expect(result.priority).toBe("Alta");
    const draft = await findDraft(app.ctx.db, result.draftId);
    expect(draft?.payload.priority).toBe("Alta");
    expect(draft?.status).toBe("aguardando_confirmacao");
    expect(app.eventsOf("draft").length).toBeGreaterThan(0);
  });

  it('"Não sei" sobre afetados: grava "só você" e registra a premissa', async () => {
    const result = await run("propose_draft", { ...vpnDraft, affected: "desconhecido", classification: { blocksWork: false, sameDayCommitment: false, hasWorkaround: false } });
    expect(result.assumptions).toEqual(['Impacto desconhecido: considerado "só você".']);
    expect((await findDraft(app.ctx.db, result.draftId))?.payload.affected).toBe("somente_voce");
  });

  it("propose_draft de novo substitui o pendente (FR-025) e informa replaced", async () => {
    const first = await run("propose_draft", vpnDraft);
    const second = await run("propose_draft", { ...vpnDraft, category: "Software", changes: "categoria" });
    expect(second.replaced).toBe(true);
    expect(second.replacedCode).toBe(first.displayCode);
    expect((await findDraft(app.ctx.db, first.draftId))?.status).toBe("substituido");
    expect((await findPendingDraft(app.ctx.db, turn.conversation.id))?.id).toBe(second.draftId);
  });

  it("propose_draft recusa chamado novo quando o próprio modelo apontou duplicado aberto", async () => {
    const result = await run("propose_draft", { ...vpnDraft, duplicateCheck: { considered: ["INC-20311"], verdict: "aberto_igual", why: "mesmo problema" } });
    expect(result.error).toBe("duplicate_open_ticket");
  });

  it("atualização: alvo precisa ser aberto e do funcionário; nova prioridade só com mudança de impacto/urgência", async () => {
    expect((await run("propose_draft", { ...vpnDraft, kind: "atualizacao", targetTicket: "INC-20519", note: "x" })).error).toBe("not_found");
    expect((await run("propose_draft", { ...vpnDraft, kind: "atualizacao", targetTicket: "INC-20150", note: "x" })).error).toBe("ticket_resolved");
    const keep = await run("propose_draft", { ...vpnDraft, kind: "atualizacao", targetTicket: "INC-20311", note: "Piorou, agora nem liga.", changesPriority: false });
    expect(keep.priority).toBe("Média");
    const raise = await run("propose_draft", { ...vpnDraft, kind: "atualizacao", targetTicket: "INC-20311", note: "Piorou, agora nem liga.", changesPriority: true });
    expect(raise.priority).toBe("Alta");
    const draft = await findDraft(app.ctx.db, raise.draftId);
    expect(draft?.payload).toMatchObject({ targetTicket: "INC-20311", note: "Piorou, agora nem liga.", newPriority: "Alta", title: "Notebook lento após atualização" });
  });

  it("reabertura só dentro de 7 dias e de chamado resolvido", async () => {
    expect((await run("propose_draft", { ...vpnDraft, kind: "reabertura", targetTicket: "INC-19877", note: "voltou" })).error).toBe("outside_reopen_window");
    expect((await run("propose_draft", { ...vpnDraft, kind: "reabertura", targetTicket: "INC-20311", note: "voltou" })).error).toBe("ticket_open");
    const ok = await run("propose_draft", { ...vpnDraft, kind: "reabertura", targetTicket: "INC-20150", note: "A senha do SAP bloqueou de novo." });
    expect(ok.ok).toBe(true);
    expect(ok.kind).toBe("reabertura");
  });

  it("offer_options aceita de 1 a 4 opções; 5 é rejeitado pelo schema", async () => {
    await run("offer_options", { options: ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"] });
    expect(turn.scratch.quickOptions).toHaveLength(4);
    turn.scratch.quickOptions = undefined;
    const invalid = await run("offer_options", { options: ["a", "b", "c", "d", "e"] }).catch((e: unknown) => ({ thrown: e }));
    expect(turn.scratch.quickOptions).toBeUndefined();
    expect(JSON.stringify(invalid)).toMatch(/error|thrown|Too big|too_big|validation/i);
  });

  it("record_decision valida enum de ação e faixa 0–100", async () => {
    const ok = await run("record_decision", { understanding: { intent: "x" }, action: "responder_central", confidence: 80, rationale: "y" });
    expect(ok).toEqual({ recorded: true });
    const badAction = await run("record_decision", { understanding: { intent: "x" }, action: "inventada", confidence: 80, rationale: "y" }).catch((e: unknown) => ({ thrown: e }));
    const badConfidence = await run("record_decision", { understanding: { intent: "x" }, action: "transferir", confidence: 150, rationale: "y" }).catch((e: unknown) => ({ thrown: e }));
    expect(turn.scratch.decisions).toHaveLength(1);
    expect(JSON.stringify(badAction)).not.toContain('"recorded":true');
    expect(JSON.stringify(badConfidence)).not.toContain('"recorded":true');
  });

  it("request_transfer, close_as_resolved e redirect só marcam o turno (efeito nas pós-ações)", async () => {
    await run("get_ticket", { number: "INC-20311" });
    await run("request_transfer", { reason: "vencido", summary: { problem: "Notebook lento", done: "Mostrou o card", tickets: ["INC-20311", "INC-20519"] } });
    expect(turn.scratch.transferRequest).toEqual({
      reason: "vencido",
      summary: { problem: "Notebook lento", done: "Mostrou o card", tickets: ["INC-20311"], priority: null },
    });
    expect(await run("redirect_out_of_scope", { area: "RH", channel: "Portal Pessoas Nexo" })).toEqual({ redirected: true });
    expect(turn.scratch.redirect?.area).toBe("RH");
    const close = await run("close_as_resolved", {});
    expect(close.allowed).toBe(false); // transferência pedida no mesmo turno
    expect(turn.scratch.closeRequested).toBe(false);
  });

  it("close_as_resolved é permitido sem rascunho pendente nem transferência", async () => {
    expect(await run("close_as_resolved", {})).toEqual({ allowed: true });
    expect(turn.scratch.closeRequested).toBe(true);
  });

  it("serviço de chamados fora do ar: ferramenta devolve erro em linguagem simples com tentativas", async () => {
    app.ctx.ticketsLocal.outageSimulator.check = () => {
      throw new TicketServiceUnavailableError();
    };
    const result = await run("list_my_tickets", {});
    expect(result).toMatchObject({ error: "tickets_unavailable", attempts: 4 });
    expect(result.message).toMatch(/instável/);
  });
});
