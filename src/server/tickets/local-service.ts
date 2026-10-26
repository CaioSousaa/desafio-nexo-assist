import { and, asc, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import type { Priority, TicketKind, TicketStatus } from "../rules/catalog";
import { migrateDb } from "../db/migrate";
import type { SqliteHandle } from "../db/client";
import { createTicketsDb, type TicketsDb } from "./db";
import {
  IdempotencyConflictError,
  InvalidTicketOperationError,
  TicketNotFoundError,
} from "./errors";
import { OutageSimulator, type OutageOptions } from "./outage";
import * as schema from "./schema";
import type { IdempotencyOptions, ListOptions, ReadScope, TicketService } from "./service";
import {
  createTicketInputSchema,
  ticketEventSchema,
  ticketSchema,
  type CreateTicketInput,
  type Ticket,
  type TicketEvent,
  type TicketEventKind,
  type TicketWithEvents,
} from "./types";

/** Numeração inicial quando o banco está vazio (o seed ajusta para depois dos números de exemplo). */
const FIRST_NUMBER: Record<TicketKind, number> = { INC: 20520, REQ: 10450 };

export interface LocalTicketServiceOptions {
  outage?: OutageOptions;
  now?: () => Date;
}

/** Chamado de exemplo com datas e histórico já definidos (usado só pelo seed). */
export interface SeedTicket {
  ticket: Ticket;
  events: Array<{ kind: TicketEventKind; text: string; author: string; createdAt: string }>;
}

const formatNumber = (kind: TicketKind, value: number) => `${kind}-${String(value).padStart(5, "0")}`;

/** Serviço de chamados simulado: banco SQLite próprio, idempotência e indisponibilidade intermitente. */
export class LocalTicketService implements TicketService {
  private readonly outage: OutageSimulator;
  private readonly now: () => Date;

  private constructor(
    private readonly handle: SqliteHandle<TicketsDb>,
    options: LocalTicketServiceOptions,
  ) {
    this.outage = new OutageSimulator(options.outage ?? { rate: 0, seconds: 0 });
    this.now = options.now ?? (() => new Date());
  }

  static async open(path: string, options: LocalTicketServiceOptions = {}): Promise<LocalTicketService> {
    const handle = await createTicketsDb(path);
    await migrateDb(handle.db, "tickets");
    for (const kind of ["INC", "REQ"] as const) {
      await handle.db
        .insert(schema.counters)
        .values({ kind, nextValue: FIRST_NUMBER[kind] })
        .onConflictDoNothing();
    }
    return new LocalTicketService(handle, options);
  }

  get outageSimulator(): OutageSimulator {
    return this.outage;
  }

  close(): void {
    this.handle.close();
  }

  private get db(): TicketsDb {
    return this.handle.db;
  }

  async listByRequester(email: string, options: ListOptions = {}): Promise<Ticket[]> {
    this.outage.check();
    const byRequester = eq(schema.tickets.requesterEmail, email);
    const where = options.resolvedSince
      ? and(
          byRequester,
          or(
            ne(schema.tickets.status, "resolvido"),
            gte(schema.tickets.resolvedAt, options.resolvedSince.toISOString()),
          ),
        )
      : byRequester;
    const rows = await this.db.select().from(schema.tickets).where(where).orderBy(desc(schema.tickets.updatedAt));
    return rows.map((row) => ticketSchema.parse(row));
  }

  async get(number: string, scope: ReadScope): Promise<Ticket | null> {
    this.outage.check();
    return this.find(number, scope);
  }

  async getWithEvents(number: string, scope: ReadScope): Promise<TicketWithEvents | null> {
    this.outage.check();
    const ticket = await this.find(number, scope);
    if (!ticket) return null;
    return { ticket, events: await this.events(ticket.number) };
  }

  async create(input: CreateTicketInput, { idempotencyKey }: IdempotencyOptions): Promise<Ticket> {
    this.outage.check();
    const data = createTicketInputSchema.parse(input);
    const existing = await this.replay(idempotencyKey, "create");
    if (existing) return existing;

    const [counter] = await this.db
      .update(schema.counters)
      .set({ nextValue: sql`${schema.counters.nextValue} + 1` })
      .where(eq(schema.counters.kind, data.kind))
      .returning({ value: schema.counters.nextValue });
    if (!counter) throw new Error(`contador ${data.kind} ausente`);
    const number = formatNumber(data.kind, counter.value - 1);
    const at = this.now().toISOString();

    try {
      await this.db.batch([
        this.db.insert(schema.idempotencyKeys).values({ key: idempotencyKey, ticketNumber: number, operation: "create", createdAt: at }),
        this.db.insert(schema.tickets).values({
          number,
          ...data,
          status: "aberto",
          createdAt: at,
          updatedAt: at,
          resolvedAt: null,
        }),
        this.db.insert(schema.ticketEvents).values({
          ticketNumber: number,
          kind: "criado",
          text: "Chamado aberto pelo Nexo Assist após confirmação do funcionário.",
          author: "via Nexo Assist",
          createdAt: at,
        }),
      ]);
    } catch (error) {
      // Corrida com a mesma chave: o lote foi desfeito; devolve o chamado de quem venceu.
      const winner = await this.replay(idempotencyKey, "create");
      if (winner) return winner;
      throw error;
    }
    return this.mustFind(number);
  }

  async addNote(
    number: string,
    note: { text: string; author: string; newPriority?: Priority },
    { idempotencyKey }: IdempotencyOptions,
  ): Promise<Ticket> {
    this.outage.check();
    const existing = await this.replay(idempotencyKey, "addNote");
    if (existing) return existing;
    const ticket = await this.mustFind(number);
    const at = this.now().toISOString();
    const changePriority = note.newPriority !== undefined && note.newPriority !== ticket.priority;
    await this.db.batch([
      this.db.insert(schema.idempotencyKeys).values({ key: idempotencyKey, ticketNumber: number, operation: "addNote", createdAt: at }),
      this.db.insert(schema.ticketEvents).values({ ticketNumber: number, kind: "nota", text: note.text, author: note.author, createdAt: at }),
      ...(changePriority
        ? [
            this.db.insert(schema.ticketEvents).values({
              ticketNumber: number,
              kind: "prioridade" as const,
              text: `Prioridade alterada de ${ticket.priority} para ${note.newPriority}.`,
              author: note.author,
              createdAt: at,
            }),
          ]
        : []),
      this.db
        .update(schema.tickets)
        .set({ updatedAt: at, ...(changePriority ? { priority: note.newPriority } : {}) })
        .where(eq(schema.tickets.number, number)),
    ]);
    return this.mustFind(number);
  }

  async reopen(
    number: string,
    note: { text: string; author: string },
    { idempotencyKey }: IdempotencyOptions,
  ): Promise<Ticket> {
    this.outage.check();
    const existing = await this.replay(idempotencyKey, "reopen");
    if (existing) return existing;
    const ticket = await this.mustFind(number);
    if (ticket.status !== "resolvido") {
      throw new InvalidTicketOperationError(`${number} não está resolvido; não há o que reabrir.`);
    }
    const at = this.now().toISOString();
    await this.db.batch([
      this.db.insert(schema.idempotencyKeys).values({ key: idempotencyKey, ticketNumber: number, operation: "reopen", createdAt: at }),
      this.db.insert(schema.ticketEvents).values({ ticketNumber: number, kind: "reaberto", text: note.text, author: note.author, createdAt: at }),
      this.db
        .update(schema.tickets)
        .set({ status: "aberto", resolvedAt: null, updatedAt: at })
        .where(eq(schema.tickets.number, number)),
    ]);
    return this.mustFind(number);
  }

  async registerTransfer(
    number: string,
    transfer: { conversationId: string; reason: string; author: string },
  ): Promise<void> {
    this.outage.check();
    await this.mustFind(number);
    await this.db.insert(schema.ticketEvents).values({
      ticketNumber: number,
      kind: "transferido",
      text: "Transferido para um analista",
      author: transfer.author,
      createdAt: this.now().toISOString(),
    });
  }

  async setStatus(
    number: string,
    status: TicketStatus,
    note: { text: string; author: string; eventKind?: TicketEventKind },
  ): Promise<Ticket> {
    this.outage.check();
    await this.mustFind(number);
    const at = this.now().toISOString();
    await this.db.batch([
      this.db.insert(schema.ticketEvents).values({
        ticketNumber: number,
        kind: note.eventKind ?? "status",
        text: note.text,
        author: note.author,
        createdAt: at,
      }),
      this.db
        .update(schema.tickets)
        .set({ status, updatedAt: at, resolvedAt: status === "resolvido" ? at : null })
        .where(eq(schema.tickets.number, number)),
    ]);
    return this.mustFind(number);
  }

  /** Carga dos dados de exemplo (ignora números já existentes) e ajuste da numeração. */
  async seed(items: SeedTicket[]): Promise<number> {
    let inserted = 0;
    for (const { ticket, events } of items) {
      const result = await this.db.insert(schema.tickets).values(ticket).onConflictDoNothing().returning({ number: schema.tickets.number });
      if (result.length === 0) continue;
      inserted += 1;
      if (events.length > 0) {
        await this.db.insert(schema.ticketEvents).values(events.map((e) => ({ ...e, ticketNumber: ticket.number })));
      }
    }
    for (const kind of ["INC", "REQ"] as const) {
      const [row] = await this.db
        .select({ max: sql<number | null>`max(cast(substr(${schema.tickets.number}, 5) as integer))` })
        .from(schema.tickets)
        .where(eq(schema.tickets.kind, kind));
      const next = Math.max(FIRST_NUMBER[kind], (row?.max ?? 0) + 1);
      await this.db
        .update(schema.counters)
        .set({ nextValue: sql`max(${schema.counters.nextValue}, ${next})` })
        .where(eq(schema.counters.kind, kind));
    }
    return inserted;
  }

  async count(): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)` }).from(schema.tickets);
    return row?.n ?? 0;
  }

  private async find(number: string, scope: ReadScope): Promise<Ticket | null> {
    const normalized = number.trim().toUpperCase();
    const [row] = await this.db.select().from(schema.tickets).where(eq(schema.tickets.number, normalized));
    if (!row) return null;
    if (scope.requesterEmail !== undefined && row.requesterEmail !== scope.requesterEmail) return null;
    return ticketSchema.parse(row);
  }

  private async mustFind(number: string): Promise<Ticket> {
    const ticket = await this.find(number, {});
    if (!ticket) throw new TicketNotFoundError(number);
    return ticket;
  }

  private async events(number: string): Promise<TicketEvent[]> {
    const rows = await this.db
      .select()
      .from(schema.ticketEvents)
      .where(eq(schema.ticketEvents.ticketNumber, number))
      .orderBy(asc(schema.ticketEvents.createdAt), asc(schema.ticketEvents.id));
    return rows.map((row) => ticketEventSchema.parse(row));
  }

  private async replay(key: string, operation: string): Promise<Ticket | null> {
    const [row] = await this.db.select().from(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.key, key));
    if (!row) return null;
    if (row.operation !== operation) throw new IdempotencyConflictError(key, row.operation);
    return this.mustFind(row.ticketNumber);
  }
}

