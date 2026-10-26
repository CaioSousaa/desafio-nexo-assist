import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANA, createTestApp, type TestApp } from "@/test/harness";
import { getOrOpenConversation } from "../conversations/service";
import { findConversation, updateConversation } from "../conversations/repo";
import { findPendingDraft } from "../drafts/repo";
import { proposeDraft } from "../drafts/service";
import { listMessages } from "../messages/repo";
import { runPostActions } from "./post-actions";
import { createTurnScratch } from "./tools/context";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

async function open() {
  const ana = await app.user(ANA);
  return (await getOrOpenConversation(app.ctx, ana.id)).conversation;
}

async function addDraft(conversationId: string) {
  const conversation = (await findConversation(app.ctx.db, conversationId))!;
  return proposeDraft(app.ctx, conversation, {
    kind: "novo",
    payload: { title: "Rede do andar caiu", description: "Ninguém do 3º andar acessa a rede.", type: "INC", category: "Rede e VPN", priority: "Crítica", affected: "equipe", deadlineAt: app.clock.now.toISOString(), rule: "", assumptions: [] },
  });
}

const summary = { problem: "Rede do andar caiu", done: "Montou rascunho", tickets: [], priority: "Crítica" };

describe("pós-ações do turno", () => {
  it("close_as_resolved encerra como resolvida pelo agent", async () => {
    const conversation = await open();
    const scratch = createTurnScratch();
    scratch.closeRequested = true;
    const transfer = vi.fn();
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 95 }, { transfer })).toEqual(["closed_resolved"]);
    const closed = await findConversation(app.ctx.db, conversation.id);
    expect(closed).toMatchObject({ state: "encerrada", outcome: "resolvida_pelo_agent" });
    expect((await listMessages(app.ctx.db, conversation.id)).at(-1)?.eventType).toBe("resolvida");
    expect(transfer).not.toHaveBeenCalled();
  });

  it("não encerra com rascunho pendente", async () => {
    const conversation = await open();
    await addDraft(conversation.id);
    const scratch = createTurnScratch();
    scratch.closeRequested = true;
    await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 95 }, { transfer: vi.fn() });
    expect((await findConversation(app.ctx.db, conversation.id))?.state).toBe("com_agent");
  });

  it("limiar: confiança 59 transfere 'baixa_confianca' com a confiança; 60 não", async () => {
    const conversation = await open();
    const transfer = vi.fn(async () => (await findConversation(app.ctx.db, conversation.id))!);
    await runPostActions(app.ctx, { conversationId: conversation.id, scratch: createTurnScratch(), confidence: 60 }, { transfer });
    expect(transfer).not.toHaveBeenCalled();
    await runPostActions(app.ctx, { conversationId: conversation.id, scratch: createTurnScratch(), confidence: 59 }, { transfer });
    expect(transfer).toHaveBeenCalledWith(app.ctx, conversation.id, expect.objectContaining({ reason: "baixa_confianca", confidence: 59 }));
  });

  it("encerrar vem antes da confiança (ordem da tech spec)", async () => {
    const conversation = await open();
    const scratch = createTurnScratch();
    scratch.closeRequested = true;
    const transfer = vi.fn();
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 10 }, { transfer })).toEqual(["closed_resolved"]);
    expect(transfer).not.toHaveBeenCalled();
  });

  it("transferência pedida sem rascunho é imediata, com o resumo do modelo", async () => {
    const conversation = await open();
    const scratch = createTurnScratch();
    scratch.transferRequest = { reason: "pedido", summary };
    const transfer = vi.fn(async () => (await findConversation(app.ctx.db, conversation.id))!);
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 90 }, { transfer })).toEqual(["transferred"]);
    expect(transfer).toHaveBeenCalledWith(app.ctx, conversation.id, { reason: "pedido", summary });
  });

  it("crítico com rascunho pendente: transferência fica agendada (pending_transfer) até Confirmar/Cancelar (D5)", async () => {
    const conversation = await open();
    await addDraft(conversation.id);
    const scratch = createTurnScratch();
    scratch.transferRequest = { reason: "critico", summary };
    const transfer = vi.fn();
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 90 }, { transfer })).toEqual(["transfer_pending_draft"]);
    expect(transfer).not.toHaveBeenCalled();
    const fresh = await findConversation(app.ctx.db, conversation.id);
    expect(fresh).toMatchObject({ state: "com_agent", pendingTransfer: true, transferReason: "critico" });
    expect(fresh?.transferSummary?.problem).toBe("Rede do andar caiu");
    expect((await findPendingDraft(app.ctx.db, conversation.id))?.transferAfterDecision).toBe(true);
  });

  it("rascunho Crítica sem request_transfer: o servidor agenda a transferência crítica mesmo assim (FR-044)", async () => {
    const conversation = await open();
    const { draft } = await addDraft(conversation.id);
    const scratch = createTurnScratch();
    scratch.draftId = draft.id;
    const transfer = vi.fn();
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 90 }, { transfer })).toEqual(["transfer_pending_draft"]);
    const fresh = await findConversation(app.ctx.db, conversation.id);
    expect(fresh).toMatchObject({ pendingTransfer: true, transferReason: "critico" });
    expect(fresh?.transferSummary?.problem).toBe("Rede do andar caiu");
    expect((await findPendingDraft(app.ctx.db, conversation.id))?.transferAfterDecision).toBe(true);
  });

  it("contador no limite: mensagem de limite com opções e limit_reached", async () => {
    const conversation = await open();
    await updateConversation(app.ctx.db, conversation.id, { agentMessageCount: 30 });
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch: createTurnScratch(), confidence: 90 }, { transfer: vi.fn() })).toEqual(["limit_reached"]);
    expect((await findConversation(app.ctx.db, conversation.id))?.limitReached).toBe(true);
    const last = (await listMessages(app.ctx.db, conversation.id)).at(-1)!;
    expect(last.authorType).toBe("agent");
    expect(last.parts.limit_options).toBe(true);
    expect(last.text).toContain("limite de 30 mensagens");
  });

  it("conversa que já não está com o agent: nenhuma pós-ação", async () => {
    const conversation = await open();
    await updateConversation(app.ctx.db, conversation.id, { state: "com_analista", assignedAnalystId: "u-rafael", agentMessageCount: 30 });
    const scratch = createTurnScratch();
    scratch.closeRequested = true;
    scratch.transferRequest = { reason: "pedido", summary };
    const transfer = vi.fn();
    expect(await runPostActions(app.ctx, { conversationId: conversation.id, scratch, confidence: 10 }, { transfer })).toEqual(["skipped_not_with_agent"]);
    expect(transfer).not.toHaveBeenCalled();
    expect((await findConversation(app.ctx.db, conversation.id))?.limitReached).toBe(false);
  });
});
