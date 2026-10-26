import { AlertTriangle } from "lucide-react";
import { Badge, priorityTone, type Tone } from "@/components/ui/Badge";
import { dayKey, formatDateTime, formatTime } from "@/lib/format";
import { AFFECTED_LABELS, DRAFT_KIND_TITLES, DRAFT_STATUS_LABELS } from "@/lib/labels";
import type { Draft } from "@/lib/types";
import { DraftActions, type DraftActionHandlers } from "./DraftActions";

const stateTone: Record<Draft["status"], Tone> = {
  aguardando_confirmacao: "warning",
  confirmado: "success",
  cancelado: "muted",
  substituido: "muted",
  expirado: "muted",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className="flex flex-wrap items-center gap-[6px] text-[14.5px] font-medium text-ink">{children}</span>
    </div>
  );
}

function deadline(at: string): string {
  return dayKey(at) === dayKey(new Date()) ? `resposta até ${formatTime(at)}` : `resposta até ${formatDateTime(at)}`;
}

/** Rascunho que o funcionário confere antes de qualquer gravação (FR-016). */
export function DraftCard({ draft, actions, error }: { draft: Draft; actions?: DraftActionHandlers | null; error?: string | null }) {
  const { payload } = draft;
  const pending = draft.status === "aguardando_confirmacao";
  const effectivePriority = payload.newPriority ?? payload.priority;
  const problem = error || (pending ? draft.lastError : null);
  return (
    <article
      aria-label={`${DRAFT_KIND_TITLES[draft.kind]} · Rascunho ${draft.displayCode}`}
      className={`w-full overflow-hidden rounded-[16px] bg-paper shadow-[0_1px_2px_#1B24310D,0_6px_18px_#1B24310A] outline outline-1 -outline-offset-1 outline-ink/10 ${pending || draft.status === "confirmado" ? "" : "opacity-60"}`}
    >
      <div className="flex flex-col gap-[6px] px-[18px] pb-[14px] pt-4">
        <div className="flex items-center gap-2 pb-[2px] text-[12.5px] text-ink-3">
          <span className="font-medium">{DRAFT_KIND_TITLES[draft.kind]}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-rule" />
          <span>Rascunho {draft.displayCode}</span>
          <span className="flex-1" />
          <Badge tone={stateTone[draft.status]}>
            {draft.status === "confirmado" && draft.resultingTicket ? `${draft.resultingTicket} · Aberto` : DRAFT_STATUS_LABELS[draft.status]}
          </Badge>
        </div>
        <h3 className={`text-[18px] font-semibold leading-[23px] tracking-[-0.2px] text-ink ${draft.status === "cancelado" || draft.status === "substituido" ? "line-through decoration-ink/30" : ""}`}>
          {payload.title}
        </h3>
        {draft.kind === "novo" && <p className="text-[13.5px] leading-[20px] text-ink-2">{payload.description}</p>}
      </div>

      {draft.kind !== "novo" && (
        <div className="mx-[18px] mb-3 rounded-[10px] bg-desk px-3 py-2 text-[13.5px] text-ink-2">
          <span className="font-medium text-ink">{payload.targetTicket}</span> · Nota: {payload.note ?? payload.description}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-[18px] pb-4 sm:grid-cols-3">
        <Field label={draft.kind === "novo" ? "Categoria" : "Tipo e categoria"}>
          {draft.kind === "novo" ? payload.category : `${payload.type} · ${payload.category}`}
        </Field>
        <Field label={payload.newPriority ? "Nova prioridade" : "Prioridade"}>
          <Badge tone={priorityTone(effectivePriority)} className="!text-[14.5px] !text-ink">
            {effectivePriority}
          </Badge>
          <span className="text-[13.5px] font-normal text-ink-3">· {deadline(payload.deadlineAt)}</span>
        </Field>
        <Field label="Afetados">{AFFECTED_LABELS[payload.affected] ?? payload.affected}</Field>
      </div>

      {(payload.rule || payload.assumptions.length > 0) && pending && (
        <p className="px-[18px] pb-3 text-[12.5px] text-ink-3">
          {payload.rule}
          {payload.assumptions.map((a) => ` ${a}`).join("")}
        </p>
      )}

      {problem && (
        <p role="alert" className="flex items-center gap-2 border-t border-rule bg-warning-soft px-[18px] py-2 text-[13px] text-warning-text">
          <AlertTriangle size={14} />
          {problem}
        </p>
      )}

      {pending && actions && <DraftActions {...actions} />}
    </article>
  );
}
