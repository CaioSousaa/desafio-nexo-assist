import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Decision } from "@/server/decisions/repo";
import { renderReport, summarize } from "./report";
import { runScenario } from "./runner";
import { SCENARIOS } from "./scenarios";
import type { ScenarioResult } from "./types";

// Suíte de avaliação do agent com o modelo real (SC-001). Uso:
//   npm run eval                       todos os cenários
//   npm run eval -- --only us3         só uma história (tag) ou ids separados por vírgula
//   npm run eval -- --delay 6000       pausa entre turnos (free tier)

try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: usa as variáveis do ambiente
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const { getEnv } = await import("@/env");
  const env = getEnv();
  const only = arg("only")?.split(",").map((v) => v.trim()).filter(Boolean);
  const delayMs = Number(arg("delay") ?? env.EVAL_DELAY_MS);
  const out = resolve(arg("out") ?? "eval/report.md");
  const selected = only?.length ? SCENARIOS.filter((s) => only.includes(s.id) || s.tags.some((t) => only.includes(t))) : SCENARIOS;
  if (selected.length === 0) {
    console.error(`Nenhum cenário para --only ${only?.join(",")}`);
    process.exit(2);
  }

  process.env.LOG_LEVEL ??= "silent";
  const modelId: `${string}/${string}` = `google/${env.GEMINI_MODEL}`;
  const model = [{ model: { id: modelId, apiKey: env.GEMINI_API_KEY }, maxRetries: 3 }];
  const startedAt = new Date();
  const results: ScenarioResult[] = [];
  const decisions: Decision[] = [];
  console.log(`Avaliando ${selected.length} cenário(s) com ${env.GEMINI_MODEL}…\n`);

  for (const [index, scenario] of selected.entries()) {
    if (index > 0 && delayMs) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const run = await runScenario(scenario, {
        model,
        modelName: env.GEMINI_MODEL,
        delayMs,
        onTurn: (_s, turn) => {
          const mark = turn.failures.length ? "✗" : "✓";
          console.log(`  ${mark} ${scenario.id} t${turn.turn} ${turn.observation.decision?.action ?? "—"} (${turn.observation.decision?.confidence ?? "—"}%)${turn.failures.length ? ` → ${turn.failures.join("; ")}` : ""}`);
        },
      });
      results.push(run.result);
      decisions.push(...run.decisions);
    } catch (error) {
      results.push({ id: scenario.id, title: scenario.title, category: scenario.category, tags: scenario.tags, passed: false, turns: [], skipped: error instanceof Error ? error.message.slice(0, 120) : String(error) });
      console.log(`  ! ${scenario.id} pulado: ${String(error)}`);
    }
  }

  writeFileSync(out, renderReport({ model: env.GEMINI_MODEL, startedAt, results, decisions }));
  const summary = summarize({ model: env.GEMINI_MODEL, startedAt, results, decisions });
  console.log(`\n${summary.passed}/${summary.total} cenários corretos (${Math.round(summary.accuracy * 100)}%). Relatório: ${out}`);
  process.exit(summary.accuracy >= 0.9 && summary.privacyLeaks === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
