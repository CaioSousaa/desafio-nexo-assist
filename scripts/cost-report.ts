import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Custo e desempenho por conversa a partir dos registros de decisão (SC-005, SC-009).

try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: caminho padrão
}

const quantile = (values: number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? 0;
};

async function main() {
  const { createAppDb } = await import("@/server/db/client");
  const { listDecisions } = await import("@/server/decisions/repo");
  const { listAllConversations } = await import("@/server/conversations/repo");
  const { listUsers } = await import("@/server/auth/users");
  const { PRICES } = await import("@/server/agent/pricing");

  const path = resolve(process.env.APP_DB_PATH || "./data/app.db");
  if (!existsSync(path)) {
    console.error(`Banco ${path} não existe. Rode o app ou npm run db:reset antes.`);
    process.exit(1);
  }
  const { db, close } = await createAppDb(path);
  try {
    const decisions = (await listDecisions(db)).filter((d) => d.source === "modelo" || d.source === "fallback");
    const names = new Map((await listUsers(db)).map((u) => [u.id, u.name]));
    const owners = new Map((await listAllConversations(db)).map((c) => [c.id, names.get(c.employeeId) ?? c.employeeId]));
    if (decisions.length === 0) {
      console.log("Nenhuma resposta do modelo registrada ainda (as conversas prontas do seed não contam).");
      return;
    }
    const byConversation = new Map<string, typeof decisions>();
    for (const d of decisions) byConversation.set(d.conversationId, [...(byConversation.get(d.conversationId) ?? []), d]);

    const rows = [...byConversation.entries()].map(([id, list]) => ({
      conversa: `${owners.get(id) ?? "?"} · ${id.slice(0, 8)}`,
      respostas: list.length,
      entrada: list.reduce((s, d) => s + (d.usage?.inputTokens ?? 0), 0),
      cache: list.reduce((s, d) => s + (d.usage?.cachedInputTokens ?? 0), 0),
      saida: list.reduce((s, d) => s + (d.usage?.outputTokens ?? 0), 0),
      custo_usd: Number(list.reduce((s, d) => s + (d.usage?.costUsd ?? 0), 0).toFixed(5)),
    }));
    console.table(rows);

    const total = rows.reduce((s, r) => s + r.custo_usd, 0);
    const durations = decisions.map((d) => d.durationMs ?? 0).filter(Boolean);
    const signals = decisions.map((d) => d.firstSignalMs ?? 0).filter(Boolean);
    const models = [...new Set(decisions.map((d) => d.model).filter(Boolean))];
    console.log(`\nRespostas do modelo: ${decisions.length} em ${rows.length} conversa(s) · modelo(s): ${models.join(", ")}`);
    console.log(`Custo estimado: US$ ${total.toFixed(4)} no total · US$ ${(total / rows.length).toFixed(4)} por conversa`);
    console.log(`Duração por resposta: p50 ${quantile(durations, 0.5)} ms · p95 ${quantile(durations, 0.95)} ms`);
    console.log(`Primeiro sinal visível: p95 ${quantile(signals, 0.95)} ms`);
    console.log(`Respostas sem record_decision (reserva): ${decisions.filter((d) => d.source === "fallback").length}`);
    console.log(`Tabela usada (US$/1M tokens): ${Object.entries(PRICES).map(([m, p]) => `${m} ${p.input}/${p.output}`).join(" · ")}`);
    console.log("Free tier do Gemini: valor cobrado R$ 0; o custo acima usa a tabela paga.");
  } finally {
    close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
