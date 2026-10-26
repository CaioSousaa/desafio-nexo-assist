import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Banco da aplicação (data/app.db). Colunas JSON ficam em `text` e são validadas com zod na leitura.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["funcionario", "analista"] }).notNull(),
  department: text("department"),
  deviceModel: text("device_model"),
  deviceOs: text("device_os"),
  analystLevel: text("analyst_level", { enum: ["N1", "N2"] }),
  passwordChangedAt: text("password_changed_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id),
    state: text("state", {
      enum: ["com_agent", "aguardando_atendente", "com_analista", "encerrada"],
    }).notNull(),
    outcome: text("outcome", {
      enum: ["resolvida_pelo_agent", "encerrada_pelo_analista", "limite_atingido"],
    }),
    assignedAnalystId: text("assigned_analyst_id").references(() => users.id),
    transferReason: text("transfer_reason", {
      enum: ["pedido", "critico", "baixa_confianca", "vencido", "limite"],
    }),
    transferConfidence: integer("transfer_confidence"),
    transferSummary: text("transfer_summary", { mode: "json" }),
    transferredAt: text("transferred_at"),
    agentMessageCount: integer("agent_message_count").notNull().default(0),
    limitReached: integer("limit_reached", { mode: "boolean" }).notNull().default(false),
    inheritedSummary: text("inherited_summary"),
    previousConversationId: text("previous_conversation_id"),
    pendingTransfer: integer("pending_transfer", { mode: "boolean" }).notNull().default(false),
    focusTicket: text("focus_ticket"),
    relatedTickets: text("related_tickets", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (t) => [
    index("conversations_employee_state_idx").on(t.employeeId, t.state),
    // Invariante: no máximo uma conversa não encerrada por funcionário.
    uniqueIndex("conversations_one_open_per_employee")
      .on(t.employeeId)
      .where(sql`state != 'encerrada'`),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    authorType: text("author_type", { enum: ["funcionario", "agent", "analista", "sistema"] }).notNull(),
    authorId: text("author_id"),
    text: text("text").notNull().default(""),
    parts: text("parts", { mode: "json" }),
    eventType: text("event_type", {
      enum: ["transferida", "assumida", "devolvida", "encerrada", "limite", "continuada", "resolvida"],
    }),
    decisionId: text("decision_id"),
    clientMessageId: text("client_message_id"),
    status: text("status", { enum: ["pending", "done", "error"] }),
    countsTowardLimit: integer("counts_toward_limit", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
    uniqueIndex("messages_conversation_client_id").on(t.conversationId, t.clientMessageId),
  ],
);

export const agentDecisions = sqliteTable(
  "agent_decisions",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    messageId: text("message_id").notNull(),
    understanding: text("understanding", { mode: "json" }).notNull(),
    action: text("action").notNull(),
    confidence: integer("confidence").notNull(),
    rationale: text("rationale").notNull(),
    rules: text("rules", { mode: "json" }).notNull(),
    steps: text("steps", { mode: "json" }).notNull(),
    usage: text("usage", { mode: "json" }),
    model: text("model"),
    source: text("source", { enum: ["modelo", "template", "fallback", "seed"] })
      .notNull()
      .default("modelo"),
    durationMs: integer("duration_ms"),
    firstSignalMs: integer("first_signal_ms"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("agent_decisions_message_idx").on(t.messageId)],
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    displayCode: text("display_code").notNull().unique(),
    kind: text("kind", { enum: ["novo", "atualizacao", "reabertura"] }).notNull(),
    status: text("status", {
      enum: ["aguardando_confirmacao", "confirmado", "cancelado", "substituido", "expirado"],
    }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    transferAfterDecision: integer("transfer_after_decision", { mode: "boolean" })
      .notNull()
      .default(false),
    resultingTicket: text("resulting_ticket"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    decidedAt: text("decided_at"),
  },
  (t) => [
    // FR-025: no máximo um rascunho pendente por conversa.
    uniqueIndex("drafts_one_pending_per_conversation")
      .on(t.conversationId)
      .where(sql`status = 'aguardando_confirmacao'`),
  ],
);

export const conversationReads = sqliteTable(
  "conversation_reads",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    analystId: text("analyst_id")
      .notNull()
      .references(() => users.id),
    lastReadAt: text("last_read_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.analystId] })],
);
