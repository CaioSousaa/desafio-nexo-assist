import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tempDir } from "@/test/tmp";
import { ScriptedModel } from "@/test/scripted-model";
import { deterministicSummarizer } from "./agent/summarize";
import { INTERRUPTED_TEXT } from "./agent/run-turn";
import { listUsers } from "./auth/users";
import { createAppContext, type AppContext } from "./context";
import { getOrOpenConversation } from "./conversations/service";
import { getMessage, insertMessage, listMessages } from "./messages/repo";
import { startup } from "./startup";

const opened: AppContext[] = [];
afterEach(() => {
  for (const ctx of opened.splice(0)) ctx.close();
});

async function open(dir: string) {
  const ctx = await createAppContext({
    appDbPath: join(dir, "app.db"),
    ticketsDbPath: join(dir, "tickets.db"),
    model: new ScriptedModel().mock,
    modelName: "gemini-3.5-flash-lite",
    summarizer: deterministicSummarizer,
  });
  opened.push(ctx);
  return ctx;
}

describe("subida do servidor (FR-080, FR-081)", () => {
  it("banco inexistente: migra e semeia", async () => {
    const ctx = await open(tempDir());
    expect(await startup(ctx)).toEqual({ seeded: true, recovered: 0 });
    expect(await listUsers(ctx.db)).toHaveLength(9);
    expect(await ctx.ticketsLocal.count()).toBe(11);
  });

  it("banco com dados: não semeia de novo; rodar duas vezes não dá erro", async () => {
    const dir = tempDir();
    const first = await open(dir);
    await startup(first);
    first.close();
    opened.pop();
    const second = await open(dir);
    expect(await startup(second)).toEqual({ seeded: false, recovered: 0 });
    expect(await startup(second)).toEqual({ seeded: false, recovered: 0 });
    expect(await listUsers(second.db)).toHaveLength(9);
  });

  it("tudo sobrevive ao reinício: conversa, mensagens e estado (SC-006)", async () => {
    const dir = tempDir();
    const before = await open(dir);
    await startup(before);
    const { conversation } = await getOrOpenConversation(before, "u-ana");
    await insertMessage(before.db, { conversationId: conversation.id, authorType: "funcionario", authorId: "u-ana", text: "VPN não conecta", createdAt: new Date().toISOString() });
    before.close();
    opened.pop();
    const after = await open(dir);
    await startup(after);
    const messages = await listMessages(after.db, conversation.id);
    expect(messages.map((m) => m.text)).toEqual(["VPN não conecta"]);
  });

  it("resposta do agent 'pending' (servidor caiu no meio) vira erro com 'Tentar de novo'; a do funcionário fica", async () => {
    const dir = tempDir();
    const before = await open(dir);
    await startup(before);
    const { conversation } = await getOrOpenConversation(before, "u-ana");
    const { message: employee } = await insertMessage(before.db, { conversationId: conversation.id, authorType: "funcionario", authorId: "u-ana", text: "oi", createdAt: new Date().toISOString() });
    const { message: pending } = await insertMessage(before.db, { conversationId: conversation.id, authorType: "agent", status: "pending", createdAt: new Date().toISOString() });
    before.close();
    opened.pop();
    const after = await open(dir);
    expect(await startup(after)).toEqual({ seeded: false, recovered: 1 });
    expect(await getMessage(after.db, pending.id)).toMatchObject({ status: "error", text: INTERRUPTED_TEXT });
    expect(await getMessage(after.db, employee.id)).toMatchObject({ text: "oi" });
  });
});
