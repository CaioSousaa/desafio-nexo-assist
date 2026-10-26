import { getEnv } from "@/env";
import { INTERRUPTED_TEXT } from "./agent/run-turn";
import { createAppContext, type AppContext } from "./context";
import { getBus } from "./events/bus";
import { logger } from "./logger";
import { listPendingAgentMessages, updateMessage } from "./messages/repo";
import { countUsers, seed } from "./seed/run";

/**
 * Prepara um contexto já migrado: semeia se o banco está vazio e marca como erro as respostas que estavam
 * em andamento quando o processo caiu (FR-081: a mensagem do funcionário fica e o chat oferece "Tentar de novo").
 */
export async function startup(ctx: AppContext): Promise<{ seeded: boolean; recovered: number }> {
  let seeded = false;
  if ((await countUsers(ctx.db)) === 0) {
    const report = await seed({ db: ctx.db, tickets: ctx.ticketsLocal, now: ctx.now() });
    logger.info("startup_seeded", { ...report });
    seeded = true;
  }
  const pending = await listPendingAgentMessages(ctx.db);
  for (const message of pending) {
    await updateMessage(ctx.db, message.id, { status: "error", text: INTERRUPTED_TEXT, parts: { error_reason: "interrompida" } });
  }
  if (pending.length > 0) logger.info("startup_recovered_pending", { count: pending.length });
  return { seeded, recovered: pending.length };
}

/** Contexto de produção (local) a partir das variáveis de ambiente. */
export async function createContextFromEnv(): Promise<AppContext> {
  const env = getEnv();
  const modelId: `${string}/${string}` = `google/${env.GEMINI_MODEL}`;
  return createAppContext({
    appDbPath: env.APP_DB_PATH,
    ticketsDbPath: env.TICKETS_DB_PATH,
    model: [{ model: { id: modelId, apiKey: env.GEMINI_API_KEY }, maxRetries: 3 }],
    modelName: env.GEMINI_MODEL,
    config: {
      confidenceThreshold: env.AGENT_CONFIDENCE_THRESHOLD,
      messageLimit: env.AGENT_MESSAGE_LIMIT,
      turnTimeoutMs: env.AGENT_TURN_TIMEOUT_MS,
    },
    outage: { rate: env.TICKETS_OUTAGE_RATE, seconds: env.TICKETS_OUTAGE_SECONDS },
    bus: getBus(),
  });
}

const holder = globalThis as unknown as { __nexoStartup?: Promise<AppContext> };

/** Memoizado em globalThis (sobrevive ao HMR); chamado por todas as rotas e páginas do servidor. */
export function ensureStarted(): Promise<AppContext> {
  holder.__nexoStartup ??= (async () => {
    const ctx = await createContextFromEnv();
    await startup(ctx);
    return ctx;
  })().catch((error: unknown) => {
    holder.__nexoStartup = undefined;
    logger.error("startup_failed", { error });
    throw error;
  });
  return holder.__nexoStartup;
}
