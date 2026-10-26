import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANA, clientId, createTestApp, type TestApp } from "@/test/harness";
import { decision } from "@/test/scripted-model";
import { acceptEmployeeMessage } from "../agent/run-turn";
import { findConversation, insertConversation, listEmployeeConversations } from "./repo";
import { closeAsResolved, getOrOpenConversation } from "./service";

let app: TestApp;
beforeEach(async () => {
  app = await createTestApp();
});
afterEach(() => app.close());

describe("ciclo de vida da conversa", () => {
  it("getOrOpenConversation reaproveita a conversa aberta", async () => {
    const ana = await app.user(ANA);
    const first = await getOrOpenConversation(app.ctx, ana.id);
    const second = await getOrOpenConversation(app.ctx, ana.id);
    expect(first.opened).toBe(true);
    expect(second.opened).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
  });

  it("aberturas simultâneas criam uma conversa só (índice único)", async () => {
    const ana = await app.user(ANA);
    const results = await Promise.all([1, 2, 3].map(() => getOrOpenConversation(app.ctx, ana.id)));
    expect(new Set(results.map((r) => r.conversation.id)).size).toBe(1);
    expect(await listEmployeeConversations(app.ctx.db, ana.id)).toHaveLength(1);
  });

  it("o banco recusa duas conversas não encerradas para o mesmo funcionário", async () => {
    const ana = await app.user(ANA);
    await insertConversation(app.ctx.db, { employeeId: ana.id, createdAt: app.clock.now.toISOString() });
    await expect(insertConversation(app.ctx.db, { employeeId: ana.id, createdAt: app.clock.now.toISOString() })).rejects.toThrow();
  });

  it("mensagem após 'Resolvida pelo agent' abre nova conversa sem resumo herdado (FR-029)", async () => {
    const ana = await app.user(ANA);
    const { conversation } = await getOrOpenConversation(app.ctx, ana.id);
    await closeAsResolved(app.ctx, conversation.id);
    app.model.push({ tools: [decision()] }, { text: "Oi de novo!" });
    const accepted = await acceptEmployeeMessage(app.ctx, ana, { text: "voltei", clientMessageId: clientId() });
    await accepted.run?.();
    expect(accepted.conversation.id).not.toBe(conversation.id);
    expect(accepted.conversation.inheritedSummary).toBeNull();
    expect(accepted.conversation.previousConversationId).toBeNull();
    expect(accepted.conversation.agentMessageCount).toBe(1);
    expect((await findConversation(app.ctx.db, conversation.id))?.outcome).toBe("resolvida_pelo_agent");
  });

  it("mensagem em conversa aguardando ou com analista não dispara o agent (FR-042)", async () => {
    const carla = await app.user("carla.mendes@nexo.com.br");
    const accepted = await acceptEmployeeMessage(app.ctx, carla, { text: "alguém?", clientMessageId: clientId() });
    expect(accepted.conversation.id).toBe("seed-conv-carla");
    expect(accepted.run).toBeNull();
    expect(accepted.agentMessage).toBeNull();
    expect(app.model.prompts).toHaveLength(0);
  });

  it("closeAsResolved recusa conversa com transferência agendada", async () => {
    const ana = await app.user(ANA);
    const { conversation } = await getOrOpenConversation(app.ctx, ana.id);
    const { updateConversation } = await import("./repo");
    await updateConversation(app.ctx.db, conversation.id, { pendingTransfer: true });
    expect(await closeAsResolved(app.ctx, conversation.id)).toBeNull();
  });
});
