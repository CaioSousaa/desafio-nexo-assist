"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dayKey, dayLabel, formatDateTime } from "@/lib/format";
import { OUTCOME_LABELS } from "@/lib/labels";
import type { LiveTurn, OptimisticMessage } from "@/hooks/useChat";
import type { ConversationBundle, Draft } from "@/lib/types";
import { AgentBubble } from "./AgentBubble";
import { AnalystBubble } from "./AnalystBubble";
import type { DraftActionHandlers } from "./DraftActions";
import { DaySeparator } from "./DaySeparator";
import { EmployeeBubble } from "./EmployeeBubble";
import { SystemEvent } from "./SystemEvent";

export interface MessageListProps {
  variant: "chat" | "console";
  bundles: ConversationBundle[];
  currentId: string | null;
  live: Record<string, LiveTurn>;
  optimistic?: OptimisticMessage[];
  /** Ações do funcionário (só no chat). */
  actions?: {
    send: (text: string) => void;
    retry: (messageId: string) => void;
    draftActions: (draft: Draft) => DraftActionHandlers | null;
    draftError: (draftId: string) => string | null;
    limit: { onContinue: () => void; onTransfer: () => void; busy: string | null };
  };
  header?: ReactNode;
  empty?: ReactNode;
}

/** Histórico com variantes por autor, eventos de sistema, separadores de dia e de conversa encerrada (FR-053). */
export function MessageList({ variant, bundles, currentId, live, optimistic = [], actions, header, empty }: MessageListProps) {
  const [openDecision, setOpenDecision] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const signature = useMemo(
    () => JSON.stringify([bundles.map((b) => [b.conversation.id, b.messages.length, b.messages.at(-1)?.status, b.drafts.length]), Object.values(live).map((l) => l.text.length + l.steps.length), optimistic.length]),
    [bundles, live, optimistic],
  );

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [signature]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const rows: ReactNode[] = [];
  bundles.forEach((bundle, bundleIndex) => {
    const isCurrent = bundle.conversation.id === currentId;
    const lastEmployeeIndex = bundle.messages.map((m) => m.authorType).lastIndexOf("funcionario");
    let lastDay = bundleIndex === 0 ? "" : dayKey(bundles[bundleIndex - 1]!.messages.at(-1)?.createdAt ?? bundle.conversation.createdAt);
    const canAct = variant === "chat" && isCurrent && bundle.conversation.state === "com_agent" && !bundle.conversation.limitReached;

    bundle.messages.forEach((message, index) => {
      const day = dayKey(message.createdAt);
      if (day !== lastDay) {
        rows.push(<DaySeparator key={`day-${bundle.conversation.id}-${day}`} label={dayLabel(message.createdAt)} />);
        lastDay = day;
      }
      switch (message.authorType) {
        case "funcionario":
          rows.push(<EmployeeBubble key={message.id} text={message.text} createdAt={message.createdAt} variant={variant} />);
          break;
        case "analista":
          rows.push(
            <AnalystBubble key={message.id} text={message.text} createdAt={message.createdAt} name={message.author?.name ?? "Analista"} level={message.author?.level ?? null} variant={variant} />,
          );
          break;
        case "sistema":
          rows.push(<SystemEvent key={message.id} text={message.text} eventType={message.eventType} summary={message.parts.summary} />);
          break;
        case "agent":
          rows.push(
            <AgentBubble
              key={message.id}
              message={message}
              live={live[message.id]}
              variant={variant}
              open={openDecision === message.id}
              onToggle={() => setOpenDecision((current) => (current === message.id ? null : message.id))}
              interactive={canAct && index > lastEmployeeIndex}
              drafts={bundle.drafts}
              draftActions={isCurrent ? actions?.draftActions : undefined}
              draftError={actions?.draftError}
              onPick={actions?.send}
              onRetry={actions && isCurrent ? () => actions.retry(message.id) : undefined}
              limit={
                actions && message.parts.limit_options
                  ? { ...actions.limit, disabled: !(isCurrent && bundle.conversation.limitReached && bundle.conversation.state === "com_agent") }
                  : undefined
              }
            />,
          );
          break;
      }
    });

    if (isCurrent) {
      for (const pending of optimistic) {
        rows.push(<EmployeeBubble key={pending.clientMessageId} text={pending.text} createdAt={pending.createdAt} variant={variant} pending />);
      }
    }

    if (bundle.conversation.state === "encerrada" && (variant === "chat" || bundleIndex < bundles.length - 1)) {
      const closedAt = bundle.conversation.closedAt ?? bundle.messages.at(-1)?.createdAt ?? bundle.conversation.createdAt;
      const reason = bundle.conversation.outcome ? OUTCOME_LABELS[bundle.conversation.outcome] : "Encerrada";
      rows.push(<DaySeparator key={`closed-${bundle.conversation.id}`} variant="closed" label={`Conversa encerrada em ${formatDateTime(closedAt)} · ${reason}`} />);
    }
  });

  if (currentId === null && optimistic.length > 0) {
    for (const pending of optimistic) {
      rows.push(<EmployeeBubble key={pending.clientMessageId} text={pending.text} createdAt={pending.createdAt} variant={variant} pending />);
    }
  }

  return (
    <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <div className={variant === "chat" ? "mx-auto flex w-full max-w-[848px] flex-col gap-5 px-5 pb-1 pt-7" : "flex flex-col px-10 pb-4 pt-5"}>
        {header}
        {bundles.length === 0 && optimistic.length === 0 ? empty : rows}
      </div>
    </div>
  );
}
