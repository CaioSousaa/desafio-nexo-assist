import type { Decision } from "@/server/decisions/repo";
import type { ScenarioResult } from "./types";

export interface ReportInput {
  model: string;
  startedAt: Date;
  results: ScenarioResult[];
  decisions: Decision[];
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);
const quantile = (values: number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? 0;
};
const ms = (value: number) => `${(value / 1000).toFixed(1).replace(".", ",")} s`;

export function summarize(input: ReportInput) {
  const scored = input.results.filter((r) => !r.skipped);
  const passed = scored.filter((r) => r.passed).length;
  const confidences = input.decisions.map((d) => d.confidence);
  const durations = input.decisions.map((d) => d.durationMs ?? 0).filter((v) => v > 0);
  const firstSignals = input.decisions.map((d) => d.firstSignalMs ?? 0).filter((v) => v > 0);
  const tokensIn = input.decisions.reduce((s, d) => s + (d.usage?.inputTokens ?? 0), 0);
  const tokensOut = input.decisions.reduce((s, d) => s + (d.usage?.outputTokens ?? 0), 0);
  const cost = input.decisions.reduce((s, d) => s + (d.usage?.costUsd ?? 0), 0);
  const privacy = scored.filter((r) => r.category === "privacidade");
  return {
    total: scored.length,
    passed,
    accuracy: scored.length ? passed / scored.length : 0,
    avgConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
    p50: quantile(durations, 0.5),
    p95: quantile(durations, 0.95),
    firstSignalP95: quantile(firstSignals, 0.95),
    tokensIn,
    tokensOut,
    cost,
    costPerScenario: scored.length ? cost / scored.length : 0,
    fallbacks: input.decisions.filter((d) => d.source === "fallback").length,
    decisions: input.decisions.length,
    privacyLeaks: privacy.filter((r) => !r.passed).length,
  };
}

export function renderReport(input: ReportInput): string {
  const s = summarize(input);
  const categories = new Map<string, { total: number; passed: number }>();
  for (const result of input.results.filter((r) => !r.skipped)) {
    const entry = categories.get(result.category) ?? { total: 0, passed: 0 };
    entry.total += 1;
    entry.passed += result.passed ? 1 : 0;
    categories.set(result.category, entry);
  }
  const lines = [
    "# Relatório da suíte de avaliação do agent",
    "",
    `Gerado em ${input.startedAt.toISOString()} com \`${input.model}\` (\`npm run eval\`). Meta do SC-001: ≥ 90% de acerto.`,
    "",
    "## Resumo",
    "",
    "| Métrica | Valor |",
    "|---------|-------|",
    `| Cenários com ação correta | **${s.passed}/${s.total} (${pct(s.passed, s.total)})** |`,
    `| Vazamentos nos cenários de privacidade (SC-003) | ${s.privacyLeaks} |`,
    `| Respostas sem record_decision (reserva) | ${s.fallbacks}/${s.decisions} |`,
    `| Confiança média | ${s.avgConfidence.toFixed(0)}% |`,
    `| Duração por resposta p50 / p95 | ${ms(s.p50)} / ${ms(s.p95)} |`,
    `| Primeiro sinal visível p95 | ${ms(s.firstSignalP95)} |`,
    `| Tokens (entrada / saída) | ${s.tokensIn.toLocaleString("pt-BR")} / ${s.tokensOut.toLocaleString("pt-BR")} |`,
    `| Custo estimado (tabela paga) | US$ ${s.cost.toFixed(4)} no total · US$ ${s.costPerScenario.toFixed(4)} por cenário |`,
    "",
    "No free tier do Gemini o valor cobrado é zero; o custo acima usa a tabela paga do modelo.",
    "",
    "## Por categoria",
    "",
    "| Categoria | Acertos |",
    "|-----------|---------|",
    ...[...categories.entries()].map(([category, entry]) => `| ${category} | ${entry.passed}/${entry.total} (${pct(entry.passed, entry.total)}) |`),
    "",
    "## Cenários",
    "",
    "| Cenário | Resultado | Ações por turno | Confiança |",
    "|---------|-----------|-----------------|-----------|",
    ...input.results.map((r) => {
      const actions = r.turns.map((t) => t.observation.decision?.action ?? "—").join(" → ");
      const confidence = r.turns.map((t) => (t.observation.decision ? `${t.observation.decision.confidence}%` : "—")).join(" → ");
      const status = r.skipped ? `pulado (${r.skipped})` : r.passed ? "✅ passou" : "❌ falhou";
      return `| \`${r.id}\` ${r.title} | ${status} | ${actions} | ${confidence} |`;
    }),
  ];
  const failed = input.results.filter((r) => !r.passed && !r.skipped);
  if (failed.length) {
    lines.push("", "## Falhas", "");
    for (const result of failed) {
      lines.push(`### ${result.id}`, "");
      for (const turn of result.turns.filter((t) => t.failures.length)) {
        lines.push(`- Turno ${turn.turn} ("${turn.input}"): ${turn.failures.join("; ")}`);
        if (turn.observation.text) lines.push(`  - Resposta: ${turn.observation.text.replace(/\s+/g, " ").slice(0, 280)}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}
