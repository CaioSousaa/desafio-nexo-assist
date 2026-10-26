import { ArrowRightLeft, CheckCircle2, CircleSlash, Hand, RotateCcw, Timer } from "lucide-react";
import type { CaseSummary } from "@/lib/types";

const icons: Record<string, React.ReactNode> = {
  transferida: <ArrowRightLeft size={13} />,
  assumida: <Hand size={13} />,
  devolvida: <RotateCcw size={13} />,
  encerrada: <CircleSlash size={13} />,
  resolvida: <CheckCircle2 size={13} />,
  limite: <Timer size={13} />,
  continuada: <RotateCcw size={13} />,
};

/** Evento de sistema centralizado entre linhas ("Transferida para o service desk · 10:05"). */
export function SystemEvent({ text, eventType, summary }: { text: string; eventType: string | null; summary?: CaseSummary | undefined }) {
  return (
    <div className="flex w-full flex-col gap-2 pb-1 pt-[18px]">
      <div className="flex w-full items-center gap-3" role="note">
        <span className="h-px flex-1 bg-ink/[0.08]" />
        <span className="flex items-center gap-[6px] text-[12px] font-medium text-ink-3">
          {eventType ? icons[eventType] : null}
          {text}
        </span>
        <span className="h-px flex-1 bg-ink/[0.08]" />
      </div>
      {summary && (
        <div className="mx-auto max-w-[600px] rounded-[12px] bg-desk px-4 py-3 text-[13px] leading-[19px] text-ink-2 outline outline-1 -outline-offset-1 outline-rule">
          <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.4px] text-ink-3">Resumo da conversa anterior</p>
          <p>{summary.problem}</p>
          {summary.done && <p className="text-ink-3">{summary.done}</p>}
          {summary.tickets.length > 0 && <p className="text-ink-3">Chamados: {summary.tickets.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
