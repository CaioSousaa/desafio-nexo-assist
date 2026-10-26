import { actionLabel } from "@/lib/labels";
import type { Decision } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.4px] text-ink-3">{title}</h4>
      {children}
    </div>
  );
}

const money = (value: number) => `US$ ${value.toFixed(4).replace(".", ",")}`;

/** Bloco "o que o agent fez e por quê" (FR-030, FR-031): Entendi, Decidi, Confiança, Por quê, Regras, Ferramentas. */
export function DecisionDetails({ decision }: { decision: Decision }) {
  const entities = Object.entries(decision.understanding.entities);
  const fromTemplate = decision.source === "template";
  const confidenceTone = decision.confidence >= 80 ? "bg-success" : decision.confidence >= 60 ? "bg-warning" : "bg-danger";
  const searches = decision.steps.filter((s) => s.tool === "search_help_center" && s.outputSummary);
  return (
    <div className="w-full rounded-[12px] bg-desk p-4 text-[13.5px] text-ink outline outline-1 -outline-offset-1 outline-rule" role="region" aria-label="Detalhe da decisão do agent">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="Entendi">
          <p>{decision.understanding.intent || "—"}</p>
          {entities.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {entities.map(([key, value]) => (
                <span key={key} className="rounded-[6px] bg-paper px-2 py-[2px] text-[12.5px] text-ink-2 outline outline-1 -outline-offset-1 outline-rule">
                  {key}: <span className="font-medium text-ink">{value}</span>
                </span>
              ))}
            </div>
          )}
          {decision.understanding.assumptions.map((a) => (
            <p key={a} className="text-[12.5px] text-warning-text">Premissa: {a}</p>
          ))}
        </Section>
        <Section title="Decidi">
          <p className="font-medium">{actionLabel(decision.action)}</p>
          {searches.map((s) => (
            <p key={s.id} className="text-[12.5px] text-ink-3">
              Central de ajuda: {s.outputSummary}
            </p>
          ))}
        </Section>
        <Section title="Confiança">
          <div className="flex items-center gap-3">
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-paper outline outline-1 -outline-offset-1 outline-rule" role="meter" aria-valuenow={decision.confidence} aria-valuemin={0} aria-valuemax={100} aria-label="Confiança">
              <div className={`h-full rounded-full ${confidenceTone}`} style={{ width: `${decision.confidence}%` }} />
            </div>
            <span className="w-11 text-right font-semibold tabular-nums">{decision.confidence}%</span>
          </div>
          {fromTemplate && <p className="text-[12.5px] text-ink-3">Resposta automática do sistema, sem modelo.</p>}
        </Section>
        <Section title="Por quê">
          <p className="leading-[20px] text-ink-2">{decision.rationale}</p>
        </Section>
      </div>

      {decision.rules.length > 0 && (
        <div className="mt-4">
          <Section title="Regras aplicadas">
            <ul className="flex flex-col gap-1 text-ink-2">
              {decision.rules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                  {rule}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {decision.steps.length > 0 && (
        <div className="mt-4">
          <Section title="Ferramentas">
            <ul className="flex flex-col divide-y divide-rule overflow-hidden rounded-[8px] bg-paper outline outline-1 -outline-offset-1 outline-rule">
              {decision.steps.map((step) => (
                <li key={step.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-[2px] px-3 py-2 text-[12.5px]">
                  <span className="font-data text-ink">{step.tool}</span>
                  <span className={`text-right font-medium ${step.ok ? "text-success-text" : "text-danger-text"}`}>
                    {step.ok ? "ok" : "falhou"} · {step.durationMs} ms{step.attempts > 1 ? ` · ${step.attempts} tentativas` : ""}
                  </span>
                  {step.inputSummary && <span className="col-span-2 font-data text-[12px] text-ink-3">entrada: {step.inputSummary}</span>}
                  {step.outputSummary && <span className="col-span-2 font-data text-[12px] text-ink-3">resultado: {step.outputSummary}</span>}
                  {step.error && <span className="col-span-2 text-[12px] text-danger-text">{step.error}. O agent avisou você e não afirmou sucesso.</span>}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {decision.usage && decision.model && (
        <p className="mt-3 text-right font-data text-[11.5px] text-ink-3">
          {decision.model} · {decision.usage.inputTokens + decision.usage.outputTokens} tokens · {money(decision.usage.costUsd)}
          {decision.durationMs ? ` · ${(decision.durationMs / 1000).toFixed(1).replace(".", ",")} s` : ""}
        </p>
      )}
    </div>
  );
}
