import { Bot, Hand, RotateCcw, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/chat/Composer";
import { formatTime } from "@/lib/format";
import type { ConsoleConversationSnapshot } from "@/lib/types";

/** Barra inferior por estado: assumir/devolver (FR-055, FR-057), composer do analista (FR-056) ou bloqueio. */
export function TakeoverBar({
  snapshot,
  analystId,
  busy,
  onTake,
  onReturn,
  onSend,
}: {
  snapshot: ConsoleConversationSnapshot;
  analystId: string;
  busy: string | null;
  onTake: () => void;
  onReturn: () => void;
  onSend: (text: string) => Promise<boolean>;
}) {
  const { conversation, employee, transfer } = snapshot;
  const firstName = employee.name.split(" ")[0];
  const mine = conversation.state === "com_analista" && conversation.assignedAnalyst?.id === analystId;

  if (mine) {
    return (
      <div className="shrink-0 border-t border-rule bg-paper px-5 pb-[14px] pt-3">
        <Composer variant="console" placeholder={`Escreva para ${firstName}…`} onSubmit={onSend} />
      </div>
    );
  }

  let icon = <Hand size={17} />;
  let title = "";
  let body = "";
  let actions: React.ReactNode = null;
  if (conversation.state === "aguardando_atendente") {
    title = `${firstName} espera um atendente`;
    body = `Agent pausado${transfer.contactTargetAt ? ` · até ${formatTime(transfer.contactTargetAt)}` : ""}${transfer.late ? " · atrasada" : ""}`;
    actions = (
      <>
        <Button variant="ghost" onClick={onReturn} loading={busy === "return"} disabled={busy !== null} icon={<RotateCcw size={15} />}>
          Devolver ao agent
        </Button>
        <Button variant="primary" onClick={onTake} loading={busy === "take"} disabled={busy !== null}>
          Assumir atendimento
        </Button>
      </>
    );
  } else if (conversation.state === "com_agent") {
    icon = <Bot size={17} />;
    title = "Nexo Assist está atendendo";
    body = "Assumir pausa o agent nesta conversa.";
    actions = (
      <Button variant="primary" onClick={onTake} loading={busy === "take"} disabled={busy !== null}>
        Assumir atendimento
      </Button>
    );
  } else if (conversation.state === "com_analista") {
    icon = <UserRoundCheck size={17} />;
    title = `Em atendimento por ${conversation.assignedAnalyst?.name ?? "outro analista"}`;
    body = "Só quem assumiu pode responder.";
  } else {
    title = "Atendimento encerrado";
    body = "A próxima mensagem do funcionário abre uma nova conversa.";
  }

  return (
    <div className="flex shrink-0 flex-col gap-[10px] border-t border-rule bg-paper px-5 pb-[14px] pt-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${conversation.state === "aguardando_atendente" ? "bg-warning-soft text-warning-text" : "bg-desk text-ink-2"}`}>{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="text-[14.5px] font-semibold text-ink">{title}</p>
          <p className="text-[12.5px] text-ink-3">{body}</p>
        </div>
        {actions}
      </div>
      {conversation.state !== "encerrada" && <Composer variant="console" placeholder="" onSubmit={() => false} lockedText="Assuma o atendimento para responder" />}
    </div>
  );
}
