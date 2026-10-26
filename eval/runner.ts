import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentModel } from "@/server/agent/agent";
import { acceptEmployeeMessage, retryAgentMessage } from "@/server/agent/run-turn";
import { deterministicSummarizer } from "@/server/agent/summarize";
import { findUserByEmail } from "@/server/auth/users";
import { createAppContext, type AppContext } from "@/server/context";
import { findConversation, findOpenConversation, listEmployeeConversations, type Conversation } from "@/server/conversations/repo";
import { getOrOpenConversation } from "@/server/conversations/service";
import { findDecisionsByMessageIds, listDecisions, type Decision } from "@/server/decisions/repo";
import { listDrafts } from "@/server/drafts/repo";
import { cancelDraft, confirmDraft } from "@/server/drafts/service";
import { getMessage, listMessages, type Message } from "@/server/messages/repo";
import { seed } from "@/server/seed/run";
import { evaluateTurn } from "./evaluate";
import type { Scenario, ScenarioResult, TurnInput, TurnObservation, TurnResult } from "./types";

export interface RunOptions {
  model: AgentModel;
  modelName: string;
  /** Pausa entre turnos (limite por minuto do free tier). */
  delayMs?: number;
  /** Novas tentativas quando o provedor devolve 429/limite. */
  rateLimitRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onTurn?: (scenario: Scenario, result: TurnResult) => void;
}

export interface ScenarioRun {
  result: ScenarioResult;
  decisions: Decision[];
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const RATE_LIMIT = /429|quota|rate.?limit|resource.?exhausted/i;

function describe(input: TurnInput): string {
  if ("user" in input) return input.user;
  return "confirmDraft" in input ? "[Confirmar rascunho]" : "[Cancelar rascunho]";
}

/** Roda um cenário em bancos temporários novos (seed + fixtures), turno a turno, chamando o agent de verdade. */
export async function runScenario(scenario: Scenario, options: RunOptions): Promise<ScenarioRun> {
  const sleep = options.sleep ?? realSleep;
  const dir = mkdtempSync(join(tmpdir(), `nexo-eval-${scenario.id}-`));
  let ctx: AppContext | null = null;
  const turns: TurnResult[] = [];
  try {
    ctx = await createAppContext({
      appDbPath: join(dir, "app.db"),
      ticketsDbPath: join(dir, "tickets.db"),
      model: options.model,
      modelName: options.modelName,
      outage: { rate: 0, seconds: 0 },
      retry: { delays: [] },
      summarizer: deterministicSummarizer,
    });
    const now = ctx.now();
    await seed({ db: ctx.db, tickets: ctx.ticketsLocal, now });
    const employee = await findUserByEmail(ctx.db, scenario.employeeEmail);
    if (!employee) throw new Error(`funcionário ${scenario.employeeEmail} não existe no seed`);
    const app = ctx;
    await scenario.setup?.(app, {
      now,
      employeeId: employee.id,
      conversation: async () => (await getOrOpenConversation(app, employee.id)).conversation,
    });

    for (const [index, turn] of scenario.turns.entries()) {
      if (index > 0 && options.delayMs) await sleep(options.delayMs);
      const startedAt = Date.now();
      const ticketsBefore = await app.ticketsLocal.count();
      const draftsBefore = new Map((await allDrafts(app, employee.id)).map((d) => [d.id, d.status]));
      let agentMessageIds: string[] = [];
      let error: string | null = null;
      let conversationId: string | null = (await findOpenConversation(app.db, employee.id))?.id ?? null;
      const messagesBefore = conversationId ? new Set((await listMessages(app.db, conversationId)).map((m) => m.id)) : new Set<string>();

      try {
        if ("user" in turn.input) {
          const accepted = await acceptEmployeeMessage(app, employee, { text: turn.input.user, clientMessageId: crypto.randomUUID() });
          conversationId = accepted.conversation.id;
          await accepted.run?.();
          if (accepted.agentMessage) {
            for (let attempt = 0; attempt < (options.rateLimitRetries ?? 3); attempt++) {
              const message = await getMessage(app.db, accepted.agentMessage.id);
              const reason = String(message?.parts.error_reason ?? "");
              if (message?.status !== "error" || !RATE_LIMIT.test(reason)) break;
              await sleep(15_000 * (attempt + 1));
              const retry = await retryAgentMessage(app, employee, accepted.agentMessage.id);
              await retry.run();
            }
          }
        } else {
          const pending = (await allDrafts(app, employee.id)).find((d) => d.status === "aguardando_confirmacao");
          if (!pending) throw new Error("não há rascunho pendente para decidir");
          conversationId = pending.conversationId;
          if ("confirmDraft" in turn.input) await confirmDraft(app, pending.id, employee);
          else await cancelDraft(app, pending.id, employee);
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }

      const conversation = (conversationId ? await findConversation(app.db, conversationId) : null) ?? ((await listEmployeeConversations(app.db, employee.id)).at(-1) as Conversation);
      const messages = conversation ? await listMessages(app.db, conversation.id) : [];
      const fresh = messages.filter((m) => !messagesBefore.has(m.id));
      const agentMessages: Message[] = fresh.filter((m) => m.authorType === "agent");
      agentMessageIds = agentMessages.map((m) => m.id);
      const decisions = await findDecisionsByMessageIds(app.db, agentMessageIds);
      const modelMessage = agentMessages.find((m) => decisions.get(m.id)?.source !== "template") ?? agentMessages[0] ?? null;
      const decision = modelMessage ? (decisions.get(modelMessage.id) ?? null) : null;
      const drafts = await allDrafts(app, employee.id);
      const newDraft = [...drafts].reverse().find((d) => !draftsBefore.has(d.id)) ?? null;
      const replacedDraft = drafts.find((d) => d.status === "substituido" && draftsBefore.get(d.id) === "aguardando_confirmacao") ?? null;
      const failedMessage = agentMessages.find((m) => m.status === "error");

      const observation: TurnObservation = {
        agentMessages,
        decision,
        text: agentMessages.map((m) => m.text).join("\n"),
        toolsCalled: decision?.steps.map((s) => s.tool) ?? [],
        articleTitles: decision?.steps.map((s) => s.articleTitle).filter((t): t is string => Boolean(t)) ?? [],
        conversation,
        newDraft,
        pendingDraft: drafts.find((d) => d.status === "aguardando_confirmacao") ?? null,
        replacedDraft,
        ticketsCreated: (await app.ticketsLocal.count()) - ticketsBefore,
        durationMs: Date.now() - startedAt,
        error: error ?? (failedMessage ? String(failedMessage.parts.error_reason ?? failedMessage.text) : null),
      };
      const failures = evaluateTurn(observation, turn.expect);
      const result: TurnResult = {
        turn: index + 1,
        input: describe(turn.input),
        failures,
        observation: {
          decision: observation.decision,
          text: observation.text,
          toolsCalled: observation.toolsCalled,
          articleTitles: observation.articleTitles,
          newDraft: observation.newDraft,
          pendingDraft: observation.pendingDraft,
          replacedDraft: observation.replacedDraft,
          ticketsCreated: observation.ticketsCreated,
          durationMs: observation.durationMs,
          error: observation.error,
          state: conversation.state,
        },
      };
      turns.push(result);
      options.onTurn?.(scenario, result);
    }

    const conversations = await listEmployeeConversations(app.db, employee.id);
    const decisions = (await Promise.all(conversations.map((c) => listDecisions(app.db, c.id)))).flat().filter((d) => d.source === "modelo" || d.source === "fallback");
    return {
      result: { id: scenario.id, title: scenario.title, category: scenario.category, tags: scenario.tags, passed: turns.every((t) => t.failures.length === 0), turns },
      decisions,
    };
  } finally {
    ctx?.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function allDrafts(ctx: AppContext, employeeId: string) {
  const conversations = await listEmployeeConversations(ctx.db, employeeId);
  return listDrafts(ctx.db, conversations.map((c) => c.id));
}
