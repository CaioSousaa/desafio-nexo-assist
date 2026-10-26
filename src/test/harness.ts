import { join } from "node:path";
import type { User } from "@/server/auth/users";
import { findUserByEmail } from "@/server/auth/users";
import { deterministicSummarizer, type Summarizer } from "@/server/agent/summarize";
import { createAppContext, type AppConfig, type AppContext } from "@/server/context";
import type { BusEvent, BusEventType } from "@/server/events/bus";
import { seed } from "@/server/seed/run";
import type { OutageOptions } from "@/server/tickets/outage";
import { ScriptedModel } from "./scripted-model";
import { tempDir } from "./tmp";

export interface TestApp {
  ctx: AppContext;
  model: ScriptedModel;
  dir: string;
  clock: { now: Date; advance(ms: number): void };
  user(email: string): Promise<User>;
  /** Eventos publicados no barramento (para asserções de tempo real). */
  events: BusEvent[];
  eventsOf(type: BusEventType, channel?: string): BusEvent[];
  close(): void;
}

export interface TestAppOptions {
  seed?: boolean;
  now?: Date;
  config?: Partial<AppConfig>;
  outage?: OutageOptions;
  summarizer?: Summarizer;
}

/** Contexto completo em bancos temporários, com modelo roteirizado, relógio controlável e retry sem espera. */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const dir = tempDir("nexo-app-");
  const clock = {
    now: options.now ?? new Date("2026-10-26T13:00:00.000Z"), // segunda, 10:00 em São Paulo
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    },
  };
  const model = new ScriptedModel();
  const ctx = await createAppContext({
    appDbPath: join(dir, "app.db"),
    ticketsDbPath: join(dir, "tickets.db"),
    model: model.mock,
    modelName: "gemini-3.5-flash-lite",
    config: options.config ?? {},
    now: () => new Date(clock.now),
    outage: options.outage ?? { rate: 0, seconds: 0 },
    retry: { sleep: async () => {} },
    summarizer: options.summarizer ?? deterministicSummarizer,
  });
  if (options.seed !== false) await seed({ db: ctx.db, tickets: ctx.ticketsLocal, now: clock.now });
  const events: BusEvent[] = [];
  const originalPublish = ctx.bus.publish.bind(ctx.bus);
  ctx.bus.publish = (channel, type, data) => {
    const event = originalPublish(channel, type, data);
    events.push(event);
    return event;
  };
  return {
    ctx,
    model,
    dir,
    clock,
    events,
    eventsOf: (type, channel) => events.filter((e) => e.type === type && (!channel || e.channel === channel)),
    async user(email) {
      const user = await findUserByEmail(ctx.db, email);
      if (!user) throw new Error(`usuário de teste ausente: ${email}`);
      return user;
    },
    close: () => ctx.close(),
  };
}

export const ANA = "ana.souza@nexo.com.br";
export const BRUNO = "bruno.tavares@nexo.com.br";
export const CARLA = "carla.mendes@nexo.com.br";
export const DIEGO = "diego.ramos@nexo.com.br";
export const ELISA = "elisa.prado@nexo.com.br";
export const RAFAEL = "rafael.lima@nexo.com.br";
export const JULIANA = "juliana.costa@nexo.com.br";

let sequence = 0;
/** clientMessageId único (uuid v4 válido) para os testes. */
export function clientId(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}
