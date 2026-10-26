import { ChevronRight } from "lucide-react";
import { chatStateLabel, type ConversationStateValue } from "@/lib/labels";

const tones: Record<ConversationStateValue | "none", string> = {
  com_agent: "bg-success-soft text-success-text [--dot:var(--color-success)]",
  none: "bg-success-soft text-success-text [--dot:var(--color-success)]",
  aguardando_atendente: "bg-warning-soft text-warning-text [--dot:var(--color-warning)]",
  com_analista: "bg-primary-soft text-primary-text [--dot:var(--color-primary)]",
  encerrada: "bg-desk text-ink-3 [--dot:var(--color-ink-3)]",
};

export function ChatTopBar({ here, state, analystName }: { here: string; state?: ConversationStateValue | null; analystName?: string | null }) {
  const key = state ?? "none";
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule px-8">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-[13.5px]">
        <span className="text-ink-3">Service desk de TI</span>
        <ChevronRight size={14} className="text-ink-3" />
        <span className="font-semibold text-ink">{here}</span>
      </nav>
      {state !== undefined && (
        <span role="status" className={`flex items-center gap-[7px] rounded-full px-[10px] py-[5px] text-[12.5px] font-semibold ${tones[key]}`}>
          <span className="h-[7px] w-[7px] rounded-full bg-[var(--dot)]" />
          {chatStateLabel(state ?? null, analystName)}
        </span>
      )}
    </header>
  );
}
