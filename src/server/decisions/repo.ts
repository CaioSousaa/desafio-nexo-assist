import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "../db/client";
import { agentDecisions } from "../db/schema";
import { logger } from "../logger";

export const stepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  labels: z.array(z.string()).catch([]),
  visible: z.boolean().catch(true),
  inputSummary: z.string().catch(""),
  outputSummary: z.string().catch(""),
  durationMs: z.number().catch(0),
  ok: z.boolean().catch(true),
  error: z.string().nullable().optional().catch(null),
  attempts: z.number().int().min(1).catch(1),
  articleTitle: z.string().optional().catch(undefined),
});
export type DecisionStep = z.infer<typeof stepSchema>;

export const understandingSchema = z.object({
  intent: z.string().catch(""),
  entities: z.record(z.string(), z.string()).catch({}),
  assumptions: z.array(z.string()).catch([]),
});
export type Understanding = z.infer<typeof understandingSchema>;

export const usageSchema = z.object({
  inputTokens: z.number().catch(0),
  outputTokens: z.number().catch(0),
  cachedInputTokens: z.number().catch(0),
  costUsd: z.number().catch(0),
});
export type DecisionUsage = z.infer<typeof usageSchema>;

export type DecisionSource = "modelo" | "template" | "fallback" | "seed";

export interface Decision {
  id: string;
  conversationId: string;
  messageId: string;
  understanding: Understanding;
  action: string;
  confidence: number;
  rationale: string;
  rules: string[];
  steps: DecisionStep[];
  usage: DecisionUsage | null;
  model: string | null;
  source: DecisionSource;
  durationMs: number | null;
  firstSignalMs: number | null;
  createdAt: string;
}

type Row = typeof agentDecisions.$inferSelect;

function parseJson<T>(schema: z.ZodType<T>, raw: unknown, fallback: T, id: string): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  logger.warn("decision_field_invalid", { decisionId: id });
  return fallback;
}

function toDecision(row: Row): Decision {
  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    understanding: parseJson(understandingSchema, row.understanding, { intent: "", entities: {}, assumptions: [] }, row.id),
    action: row.action,
    confidence: row.confidence,
    rationale: row.rationale,
    rules: parseJson(z.array(z.string()), row.rules, [], row.id),
    steps: parseJson(z.array(stepSchema), row.steps, [], row.id),
    usage: row.usage ? parseJson(usageSchema, row.usage, null as unknown as DecisionUsage, row.id) : null,
    model: row.model,
    source: row.source,
    durationMs: row.durationMs,
    firstSignalMs: row.firstSignalMs,
    createdAt: row.createdAt,
  };
}

export type NewDecision = Omit<Decision, "id" | "usage" | "model" | "durationMs" | "firstSignalMs"> & {
  id?: string;
  usage?: DecisionUsage | null;
  model?: string | null;
  durationMs?: number | null;
  firstSignalMs?: number | null;
};

export async function insertDecision(db: AppDb, input: NewDecision): Promise<Decision> {
  const [row] = await db
    .insert(agentDecisions)
    .values({
      id: input.id ?? randomUUID(),
      conversationId: input.conversationId,
      messageId: input.messageId,
      understanding: input.understanding,
      action: input.action,
      confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
      rationale: input.rationale,
      rules: input.rules,
      steps: input.steps,
      usage: input.usage ?? null,
      model: input.model ?? null,
      source: input.source,
      durationMs: input.durationMs ?? null,
      firstSignalMs: input.firstSignalMs ?? null,
      createdAt: input.createdAt,
    })
    .returning();
  if (!row) throw new Error("falha ao gravar decisão");
  return toDecision(row);
}

export async function findDecisionsByMessageIds(db: AppDb, messageIds: string[]): Promise<Map<string, Decision>> {
  const map = new Map<string, Decision>();
  if (messageIds.length === 0) return map;
  const rows = await db.select().from(agentDecisions).where(inArray(agentDecisions.messageId, messageIds));
  for (const row of rows) map.set(row.messageId, toDecision(row));
  return map;
}

export async function listDecisions(db: AppDb, conversationId?: string): Promise<Decision[]> {
  const query = db.select().from(agentDecisions);
  const rows = conversationId
    ? await query.where(eq(agentDecisions.conversationId, conversationId)).orderBy(asc(agentDecisions.createdAt))
    : await query.orderBy(asc(agentDecisions.createdAt));
  return rows.map(toDecision);
}
