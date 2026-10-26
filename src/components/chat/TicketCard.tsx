import { Badge, priorityTone, statusTone } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { TICKET_STATUS_LABELS } from "@/lib/labels";
import type { TicketCard as Card } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className="flex items-center gap-[6px] text-[14.5px] font-medium text-ink">{children}</span>
    </div>
  );
}

/** Card do chamado com prazo e marca "prazo vencido" (FR-020). */
export function TicketCard({ card }: { card: Card }) {
  return (
    <article className="w-full overflow-hidden rounded-[16px] bg-paper shadow-[0_1px_2px_#1B24310D,0_6px_18px_#1B24310A] outline outline-1 -outline-offset-1 outline-ink/10">
      <div className="flex flex-col gap-[6px] px-[18px] pb-[14px] pt-4">
        <div className="flex items-center gap-2 pb-[2px] text-[12.5px] text-ink-3">
          <span className="font-medium">Chamado</span>
          <span className="h-[3px] w-[3px] rounded-full bg-rule" />
          <span>{card.number}</span>
          <span className="flex-1" />
          <Badge tone={statusTone(card.status)}>{TICKET_STATUS_LABELS[card.status]}</Badge>
        </div>
        <h3 className="text-[18px] font-semibold leading-[23px] tracking-[-0.2px] text-ink">{card.title}</h3>
        {card.description && <p className="text-[13.5px] leading-[20px] text-ink-2">{card.description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule px-[18px] pb-4 pt-3 sm:grid-cols-4">
        <Field label="Categoria">{card.category}</Field>
        <Field label="Prioridade">
          <Badge tone={priorityTone(card.priority)} className="!text-[14.5px] !text-ink">
            {card.priority}
          </Badge>
        </Field>
        <Field label="Aberto em">{formatDateTime(card.createdAt)}</Field>
        <Field label="Última atualização">
          <span className={card.overdue ? "text-warning-text" : ""}>{card.lastUpdateText || formatDateTime(card.updatedAt)}</span>
          {card.overdue && <span className="text-[13.5px] font-normal text-danger-text">· prazo vencido</span>}
        </Field>
      </div>
      {card.overdue && card.ruleText && (
        <p className="border-t border-rule bg-danger-soft px-[18px] py-2 text-[12.5px] text-danger-text">
          Prazo da prioridade {card.ruleText.toLowerCase()} · {card.overdueByText}
        </p>
      )}
    </article>
  );
}
