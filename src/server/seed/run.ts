import { eq, sql } from "drizzle-orm";
import { addBusinessHours } from "../rules/business-hours";
import type { AppDb } from "../db/client";
import { agentDecisions, conversations, drafts, messages, users } from "../db/schema";
import type { LocalTicketService } from "../tickets";
import { seedConversations } from "./conversations";
import { seedTickets } from "./tickets";
import { seedUsers } from "./users";

export interface SeedReport {
  users: number;
  tickets: number;
  conversations: number;
}

const MIN = 60_000;

/** Carga idempotente dos dados de exemplo: usuários por e-mail, chamados por número, conversas por id. */
export async function seed(options: { db: AppDb; tickets: LocalTicketService; now: Date }): Promise<SeedReport> {
  const { db, now } = options;
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * MIN).toISOString();

  const insertedUsers = await db.insert(users).values(seedUsers(now)).onConflictDoNothing().returning({ id: users.id });
  const insertedTickets = await options.tickets.seed(seedTickets(now));

  let insertedConversations = 0;
  for (const conversation of seedConversations(now)) {
    const [exists] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, conversation.id));
    if (exists) continue;
    const lastMessage = Math.min(...conversation.messages.map((m) => m.minutesAgo));
    const firstMessage = Math.max(...conversation.messages.map((m) => m.minutesAgo));
    await db.insert(conversations).values({
      id: conversation.id,
      employeeId: conversation.employeeId,
      state: conversation.state,
      outcome: conversation.outcome ?? null,
      assignedAnalystId: conversation.assignedAnalystId ?? null,
      transferReason: conversation.transferReason ?? null,
      transferConfidence: conversation.transferConfidence ?? null,
      transferSummary: conversation.transferSummary ?? null,
      transferredAt: conversation.transferredMinutesAgo !== undefined ? iso(conversation.transferredMinutesAgo) : null,
      agentMessageCount: conversation.messages.filter((m) => m.counts).length,
      limitReached: false,
      pendingTransfer: false,
      focusTicket: conversation.focusTicket ?? null,
      relatedTickets: conversation.relatedTickets,
      createdAt: iso(firstMessage),
      updatedAt: iso(lastMessage),
      closedAt: conversation.closedMinutesAgo !== undefined ? iso(conversation.closedMinutesAgo) : null,
    });
    for (const draft of conversation.drafts ?? []) {
      const { deadlineMinutesFromCreation, ...payload } = draft.payload;
      const createdAt = new Date(now.getTime() - draft.minutesAgo * MIN);
      await db.insert(drafts).values({
        id: `seed-draft-${draft.key}`,
        conversationId: conversation.id,
        displayCode: draft.displayCode,
        kind: draft.kind,
        status: draft.status,
        payload: {
          ...payload,
          deadlineAt: addBusinessHours(createdAt, (deadlineMinutesFromCreation / (24 * 60)) * 10).toISOString(),
        },
        transferAfterDecision: false,
        resultingTicket: draft.resultingTicket,
        createdAt: createdAt.toISOString(),
        decidedAt: draft.decidedMinutesAgo !== null ? iso(draft.decidedMinutesAgo) : null,
      });
    }
    let index = 0;
    for (const message of conversation.messages) {
      index += 1;
      const messageId = `${conversation.id.replace("conv", "msg")}-${String(index).padStart(2, "0")}`;
      const decisionId = message.decision ? `${messageId}-decision` : null;
      await db.insert(messages).values({
        id: messageId,
        conversationId: conversation.id,
        authorType: message.by,
        authorId: message.authorId ?? (message.by === "funcionario" ? conversation.employeeId : null),
        text: message.text ?? "",
        parts: message.parts ?? null,
        eventType: message.event ?? null,
        decisionId,
        status: message.by === "agent" ? "done" : null,
        countsTowardLimit: message.counts ?? false,
        createdAt: iso(message.minutesAgo),
      });
      if (message.decision && decisionId) {
        const d = message.decision;
        await db.insert(agentDecisions).values({
          id: decisionId,
          conversationId: conversation.id,
          messageId,
          understanding: { intent: d.intent, entities: d.entities ?? {}, assumptions: d.assumptions ?? [] },
          action: d.action,
          confidence: d.confidence,
          rationale: d.rationale,
          rules: d.rules,
          steps: d.steps.map((s, i) => ({
            id: `${decisionId}-step-${i + 1}`,
            tool: s.tool,
            labels: s.labels,
            visible: s.visible ?? s.labels.length > 0,
            inputSummary: s.input,
            outputSummary: s.output,
            durationMs: s.ms ?? 10,
            ok: true,
            error: null,
            attempts: 1,
            ...(s.articleTitle ? { articleTitle: s.articleTitle } : {}),
          })),
          usage: d.confidence === 100 ? null : { inputTokens: 2400, outputTokens: 160, cachedInputTokens: 1800, costUsd: 0.0006 },
          model: d.confidence === 100 ? null : "gemini-3.5-flash-lite",
          source: "seed",
          durationMs: d.confidence === 100 ? 90 : 2300,
          firstSignalMs: d.confidence === 100 ? null : 700,
          createdAt: iso(message.minutesAgo),
        });
      }
    }
    insertedConversations += 1;
  }

  return { users: insertedUsers.length, tickets: insertedTickets, conversations: insertedConversations };
}

export async function countUsers(db: AppDb): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(users);
  return row?.n ?? 0;
}
