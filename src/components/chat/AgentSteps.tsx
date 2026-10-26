"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { actionLabel } from "@/lib/labels";
import type { Decision, DecisionStep, LiveStep } from "@/lib/types";

type AnyStep = (DecisionStep | LiveStep) & { status?: "running" | "done" };

/** Passos acima da resposta, na ordem em que aconteceram (FR-011). Clicar abre o detalhe da decisão. */
export function AgentSteps({
  steps,
  decision,
  open,
  onToggle,
  align = "start",
  tone = "light",
}: {
  steps: AnyStep[];
  decision: Decision | null;
  open: boolean;
  onToggle?: () => void;
  align?: "start" | "end";
  tone?: "light" | "dim";
}) {
  const pills = steps.filter((s) => s.visible).flatMap((step) => step.labels.map((label, i) => ({ step, label, key: `${step.id}-${i}` })));
  if (pills.length === 0 && decision) pills.push({ step: { id: "decision", tool: "record_decision", labels: [], visible: true, inputSummary: "", outputSummary: "", durationMs: 0, ok: true, attempts: 1, error: null }, label: actionLabel(decision.action).toLowerCase(), key: "decision" });
  if (pills.length === 0) return null;
  const clickable = Boolean(decision && onToggle);
  const content = (
    <>
      {pills.map(({ step, label, key }) => {
        const running = step.status === "running";
        const failed = !step.ok;
        return (
          <span key={key} className={`inline-flex items-center gap-[5px] text-[12.5px] ${failed ? "text-danger-text" : "text-ink-3"}`} title={failed ? `falhou após ${step.attempts} tentativa(s)` : undefined}>
            {running ? <Spinner size={11} className="text-ink-3" /> : failed ? <X size={13} strokeWidth={2.5} /> : <Check size={13} strokeWidth={2.5} className="text-success-text" />}
            {label}
          </span>
        );
      })}
      {clickable && <ChevronDown size={14} className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />}
    </>
  );
  return clickable ? (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Fechar detalhe da decisão" : "Ver o que o agent fez e por quê"}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] text-left hover:underline hover:decoration-ink/20 hover:underline-offset-4 ${align === "end" ? "justify-end" : ""} ${tone === "dim" ? "opacity-90" : ""}`}
    >
      {content}
    </button>
  ) : (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${align === "end" ? "justify-end" : ""}`}>{content}</div>
  );
}
