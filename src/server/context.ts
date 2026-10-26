import { createAgentRunner, type AgentModel, type AgentRunner } from "./agent/agent";
import { createModelSummarizer, type Summarizer } from "./agent/summarize";
import { createAppDb, type AppDb, type SqliteHandle } from "./db/client";
import { migrateDb } from "./db/migrate";
import { EventBus } from "./events/bus";
import { openTicketModule, type LocalTicketService, type RetryingTicketService } from "./tickets";
import type { OutageOptions } from "./tickets/outage";
import type { RetryOptions } from "./tickets/with-retry";

export interface AppConfig {
  /** Abaixo desta confiança o agent transfere com motivo "agent sem segurança" (FR-032). */
  confidenceThreshold: number;
  /** Mensagens do funcionário ao agent por conversa (FR-070). */
  messageLimit: number;
}

/** Raiz de composição: tudo que um turno, uma rota ou um teste precisa, sem singletons escondidos. */
export interface AppContext {
  db: AppDb;
  tickets: RetryingTicketService;
  ticketsLocal: LocalTicketService;
  bus: EventBus;
  config: AppConfig;
  now: () => Date;
  agent: AgentRunner;
  summarizer: Summarizer;
  close(): void;
}

export interface CreateAppContextOptions {
  appDbPath: string;
  ticketsDbPath: string;
  model: AgentModel;
  modelName: string;
  config?: Partial<AppConfig>;
  now?: () => Date;
  outage?: OutageOptions;
  retry?: RetryOptions;
  summarizer?: Summarizer;
  bus?: EventBus;
}

export const DEFAULT_CONFIG: AppConfig = { confidenceThreshold: 60, messageLimit: 30 };

export async function createAppContext(options: CreateAppContextOptions): Promise<AppContext> {
  const now = options.now ?? (() => new Date());
  const app: SqliteHandle<AppDb> = await createAppDb(options.appDbPath);
  await migrateDb(app.db, "app");
  const tickets = await openTicketModule(options.ticketsDbPath, {
    now,
    ...(options.outage ? { outage: options.outage } : {}),
    ...(options.retry ? { retry: options.retry } : {}),
  });
  return {
    db: app.db,
    tickets: tickets.service,
    ticketsLocal: tickets.local,
    bus: options.bus ?? new EventBus(),
    config: { ...DEFAULT_CONFIG, ...options.config },
    now,
    agent: createAgentRunner(options.model, options.modelName),
    summarizer: options.summarizer ?? createModelSummarizer(options.model),
    close() {
      app.close();
      tickets.local.close();
    },
  };
}
