import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ConsoleConversationSnapshot } from "@/lib/types";
import { TicketPanelItem } from "./TicketPanelItem";

/** "Chamados de <nome>" (FR-054): os desta conversa com último evento e os demais com status. */
export function TicketPanel({ snapshot, onRetry }: { snapshot: ConsoleConversationSnapshot | null; onRetry: () => void }) {
  if (!snapshot) return <aside className="hidden h-full w-[340px] shrink-0 border-l border-rule bg-paper xl:block" />;
  const firstName = snapshot.employee.name.split(" ")[0];
  const panel = snapshot.tickets;
  return (
    <aside className="hidden h-full w-[340px] shrink-0 flex-col border-l border-rule bg-paper xl:flex" aria-label={`Chamados de ${firstName}`}>
      <header className="flex h-16 shrink-0 flex-col justify-center gap-[2px] border-b border-rule px-5">
        <h2 className="text-[15.5px] font-semibold text-ink">Chamados de {firstName}</h2>
        {panel.ok && (
          <p className="text-[12.5px] text-ink-3">
            {panel.counts.open} abertos · {panel.counts.closed} encerrados
          </p>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        {!panel.ok ? (
          <div className="flex flex-col items-start gap-3 rounded-[12px] bg-warning-soft p-4 text-[13.5px] text-warning-text" role="alert">
            {panel.message}
            <Button variant="secondary" onClick={onRetry} icon={<RotateCcw size={14} />}>
              Tentar de novo
            </Button>
          </div>
        ) : panel.ofConversation.length + panel.others.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">Nenhum chamado</p>
        ) : (
          <div className="flex flex-col gap-8">
            {panel.ofConversation.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-[12.5px] font-semibold text-ink-3">Desta conversa</h3>
                {panel.ofConversation.map((item) => (
                  <TicketPanelItem key={item.ticket.number} item={item} highlighted />
                ))}
              </section>
            )}
            {panel.others.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-[12.5px] font-semibold text-ink-3">Outros chamados</h3>
                {panel.others.map((item) => (
                  <TicketPanelItem key={item.ticket.number} item={item} highlighted={false} />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
