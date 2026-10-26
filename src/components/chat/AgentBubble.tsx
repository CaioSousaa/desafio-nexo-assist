"use client";

import { formatTime } from "@/lib/format";
import type { LiveTurn } from "@/hooks/useChat";
import type { Draft, MessageView } from "@/lib/types";
import { AgentSteps } from "./AgentSteps";
import { DecisionDetails } from "./DecisionDetails";
import type { DraftActionHandlers } from "./DraftActions";
import { DraftCard } from "./DraftCard";
import { ErrorBubble } from "./ErrorBubble";
import { LimitNotice } from "./LimitNotice";
import { QuickOptions } from "./QuickOptions";
import { TicketCard } from "./TicketCard";
import { TicketPicker } from "./TicketPicker";

export interface AgentBubbleProps {
  message: MessageView;
  live?: LiveTurn | undefined;
  variant: "chat" | "console";
  open: boolean;
  onToggle: () => void;
  /** Opções e lista de chamados clicáveis (só a resposta mais recente, com o agent atendendo). */
  interactive: boolean;
  drafts: Draft[];
  draftActions?: ((draft: Draft) => DraftActionHandlers | null) | undefined;
  draftError?: ((draftId: string) => string | null) | undefined;
  onPick?: ((text: string) => void) | undefined;
  onRetry?: (() => void) | undefined;
  limit?: { onContinue: () => void; onTransfer: () => void; busy: string | null; disabled: boolean } | undefined;
}

function Typing() {
  return (
    <span className="nexo-typing inline-flex gap-1 py-2" aria-label="Nexo Assist está digitando">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-[6px] w-[6px] rounded-full bg-ink-3" />
      ))}
    </span>
  );
}

/** Resposta do Nexo Assist: passos acima, texto (progressivo), partes ricas e o detalhe da decisão (FR-011, FR-031). */
export function AgentBubble({ message, live, variant, open, onToggle, interactive, drafts, draftActions, draftError, onPick, onRetry, limit }: AgentBubbleProps) {
  const pending = message.status === "pending";
  const text = pending ? (live?.text ?? "") : message.text;
  const steps = pending ? (live?.steps ?? []) : (message.decision?.steps ?? []);
  const draft = message.parts.draft_id ? drafts.find((d) => d.id === message.parts.draft_id) : undefined;
  const console = variant === "console";

  const header = (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${console ? "justify-end px-1" : ""}`}>
      <span className="flex items-center gap-[6px]">
        <span className={`font-semibold ${console ? "text-[12px] text-ink-2" : "text-[12.5px] text-ink"}`}>Nexo Assist</span>
        <span className="rounded-[6px] bg-primary-soft px-[6px] py-[1px] text-[11px] font-semibold text-primary-text">IA</span>
      </span>
      <AgentSteps steps={steps} decision={message.decision} open={open} onToggle={message.decision ? onToggle : undefined} align={console ? "end" : "start"} />
    </div>
  );

  const quickOptions = message.parts.quick_options?.length ? (
    <QuickOptions options={message.parts.quick_options} disabled={!interactive || !onPick} onPick={(option) => onPick?.(option)} />
  ) : null;

  return (
    <div className={`flex w-full flex-col gap-[6px] ${console ? "items-end pt-4" : "items-start"}`}>
      {header}

      {message.status === "error" ? (
        <ErrorBubble text={message.text || "Não consegui responder agora."} onRetry={console ? undefined : onRetry} />
      ) : (
        (text || pending) && (
          <div
            className={
              console
                ? "flex max-w-[78%] flex-col items-end gap-2 rounded-[12px_4px_12px_12px] bg-agent-soft px-3 pb-[6px] pt-2"
                : "flex max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] bg-paper px-4 py-3 outline outline-1 -outline-offset-1 outline-rule"
            }
          >
            {text ? <p className="w-full whitespace-pre-wrap break-words text-[14.5px] leading-[22px] text-ink">{text}</p> : <Typing />}
            {!console && quickOptions}
            {console && <time className="text-[11px] text-ink-3">{formatTime(message.createdAt)}</time>}
          </div>
        )
      )}
      {console && quickOptions}

      {message.parts.ticket_list && (
        <div className="w-full max-w-[808px]">
          <TicketPicker tickets={message.parts.ticket_list} disabled={!interactive || !onPick} onPick={(t) => onPick?.(t)} />
        </div>
      )}
      {message.parts.ticket_card && (
        <div className="w-full max-w-[808px]">
          <TicketCard card={message.parts.ticket_card} />
        </div>
      )}
      {draft && (
        <div className="w-full max-w-[808px]">
          <DraftCard draft={draft} actions={draftActions?.(draft) ?? null} error={draftError?.(draft.id) ?? null} />
        </div>
      )}
      {message.parts.limit_options && limit && <LimitNotice {...limit} />}

      {open && message.decision && (
        <div className="w-full max-w-[808px]">
          <DecisionDetails decision={message.decision} />
        </div>
      )}
    </div>
  );
}
