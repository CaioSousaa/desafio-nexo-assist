"use client";

import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDayShort } from "@/lib/format";
import { TICKET_STATUS_LABELS } from "@/lib/labels";
import type { TicketSummary } from "@/lib/types";

/** Lista selecionável de chamados (FR-019); a escolha vira mensagem do funcionário (FR-023). */
export function TicketPicker({ tickets, disabled, onPick }: { tickets: TicketSummary[]; disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div role="list" className="w-full overflow-hidden rounded-[16px] bg-paper shadow-[0_1px_2px_#1B24310D,0_6px_18px_#1B24310A] outline outline-1 -outline-offset-1 outline-ink/10">
      {tickets.map((ticket, index) => (
        <button
          key={ticket.number}
          role="listitem"
          type="button"
          disabled={disabled}
          onClick={() => onPick(`${ticket.number} · ${ticket.title}`)}
          className={`flex h-[46px] w-full items-center gap-[14px] px-4 text-left transition-colors enabled:hover:bg-cta/[0.04] disabled:cursor-default ${index > 0 ? "border-t border-rule" : ""}`}
        >
          <span className="h-4 w-4 shrink-0 rounded-full bg-paper outline outline-1 -outline-offset-1 outline-ink/25" />
          <span className="w-[76px] shrink-0 text-[12.5px] font-medium text-ink-3">{ticket.number}</span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{ticket.title}</span>
          <Badge tone={statusTone(ticket.status)} className="shrink-0 !text-ink-3 font-normal">
            {TICKET_STATUS_LABELS[ticket.status]}
            {ticket.overdue && <span className="text-danger-text"> · vencido</span>}
          </Badge>
          <span className="w-11 shrink-0 text-right text-[12.5px] text-ink-3">{formatDayShort(ticket.createdAt)}</span>
        </button>
      ))}
    </div>
  );
}
