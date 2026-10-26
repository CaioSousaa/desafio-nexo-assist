import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Banco do serviço de chamados (data/tickets.db). Só o módulo src/server/tickets abre este arquivo.

export const tickets = sqliteTable(
  "tickets",
  {
    number: text("number").primaryKey(),
    kind: text("kind", { enum: ["INC", "REQ"] }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    affected: text("affected").notNull(),
    requesterEmail: text("requester_email").notNull(),
    status: text("status", {
      enum: ["aberto", "em_andamento", "aguardando_analista", "em_atendimento", "aprovado", "resolvido"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (t) => [index("tickets_requester_status_idx").on(t.requesterEmail, t.status)],
);

export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketNumber: text("ticket_number")
      .notNull()
      .references(() => tickets.number),
    kind: text("kind", {
      enum: ["criado", "nota", "prioridade", "status", "reaberto", "transferido", "assumido"],
    }).notNull(),
    text: text("text").notNull(),
    author: text("author").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketNumber, t.createdAt)],
);

export const counters = sqliteTable("counters", {
  kind: text("kind").primaryKey(),
  nextValue: integer("next_value").notNull(),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  ticketNumber: text("ticket_number").notNull(),
  operation: text("operation").notNull(),
  createdAt: text("created_at").notNull(),
});
