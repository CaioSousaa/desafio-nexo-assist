"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge, priorityTone, statusTone } from "@/components/ui/Badge";
import { formatDateTime, formatDayShort, formatTime } from "@/lib/format";
import { TICKET_STATUS_LABELS } from "@/lib/labels";
import type { TicketPanelItem as Item } from "@/lib/types";

export function TicketPanelItem({ item, highlighted }: { item: Item; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const { ticket } = item;
  const resolved = ticket.status === "resolvido";
  const statusText = resolved && ticket.resolvedAt ? `Resolvido em ${formatDayShort(ticket.resolvedAt)}` : TICKET_STATUS_LABELS[ticket.status];
  return (
    <div className={highlighted ? "rounded-[12px] bg-desk p-4" : "border-b border-rule py-3 last:border-b-0"}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        {!highlighted && <span className={`mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full ${resolved ? "bg-ink/25" : item.overdue ? "bg-danger" : "bg-warning"}`} />}
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {highlighted && (
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="font-medium text-ink-3">{ticket.number}</span>
              <Badge tone={statusTone(ticket.status)} showDot={false} className="font-semibold">
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
            </div>
          )}
          <span className={`text-ink ${highlighted ? "text-[15.5px] font-semibold leading-[20px]" : "text-[14.5px] font-medium"}`}>{ticket.title}</span>
          <span className="text-[12.5px] text-ink-3">
            {highlighted ? `${ticket.category} · prioridade ${ticket.priority.toLowerCase()}` : `${ticket.number} · ${statusText}`}
            {item.overdue && <span className="text-danger-text"> · prazo vencido</span>}
          </span>
        </div>
        <ChevronDown size={15} className={`mt-1 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {highlighted && item.lastEvent && (
        <p className="mt-3 flex items-center gap-2 border-t border-rule pt-3 text-[13.5px] text-ink-2">
          {item.lastEvent.text}
          <span className="text-[12.5px] text-ink-3">{formatTime(item.lastEvent.createdAt)}</span>
        </p>
      )}
      {open && (
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
          <p>{ticket.description}</p>
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-[12px] text-ink-3">Prioridade</dt>
              <dd>
                <Badge tone={priorityTone(ticket.priority)} className="!text-ink">
                  {ticket.priority}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">Tipo</dt>
              <dd>{ticket.kind}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">Aberto em</dt>
              <dd>{formatDateTime(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">Última atualização</dt>
              <dd>{formatDateTime(ticket.updatedAt)}</dd>
            </div>
          </dl>
          {item.events.length > 0 && (
            <ol className="flex flex-col gap-1 border-l border-rule pl-3">
              {item.events.map((event) => (
                <li key={event.id} className="text-[12.5px]">
                  <span className="text-ink-3">{formatDateTime(event.createdAt)} · {event.author}</span>
                  <br />
                  {event.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
