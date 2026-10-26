import { CircleSlash, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { ConsoleConversationSnapshot } from "@/lib/types";

export function ConversationHeader({
  snapshot,
  analystId,
  busy,
  onReturn,
  onClose,
}: {
  snapshot: ConsoleConversationSnapshot;
  analystId: string;
  busy: string | null;
  onReturn: () => void;
  onClose: () => void;
}) {
  const { conversation, employee } = snapshot;
  const mine = conversation.state === "com_analista" && conversation.assignedAnalyst?.id === analystId;
  const meta = ["online", employee.department, conversation.focusTicket].filter(Boolean).join(" · ");
  const mode =
    conversation.state === "aguardando_atendente"
      ? { label: "Aguardando atendente", cls: "bg-warning-soft text-warning-text" }
      : conversation.state === "com_agent"
        ? { label: "Com o agent", cls: "bg-primary-soft text-primary-text" }
        : conversation.state === "com_analista"
          ? { label: mine ? "Você está atendendo" : `Em atendimento por ${conversation.assignedAnalyst?.name ?? "outro analista"}`, cls: "bg-success-soft text-success-text" }
          : { label: "Encerrada", cls: "bg-desk text-ink-3" };
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-paper pl-5 pr-4">
      <Avatar name={employee.name} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <h2 className="truncate text-[15.5px] font-semibold text-ink">{employee.name}</h2>
        <p className="truncate text-[12.5px] text-ink-3">{meta}</p>
      </div>
      {mine ? (
        <>
          <Button variant="ghost" onClick={onReturn} loading={busy === "return"} disabled={busy !== null} icon={<RotateCcw size={15} />}>
            Devolver ao agent
          </Button>
          <Button variant="danger" onClick={onClose} loading={busy === "close"} disabled={busy !== null} icon={<CircleSlash size={15} />}>
            Encerrar atendimento
          </Button>
        </>
      ) : (
        <span className={`rounded-full px-[11px] py-[6px] text-[12.5px] font-semibold ${mode.cls}`}>{mode.label}</span>
      )}
    </header>
  );
}
