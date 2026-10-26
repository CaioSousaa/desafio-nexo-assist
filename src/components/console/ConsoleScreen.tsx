"use client";

import { MessagesSquare } from "lucide-react";
import { MessageList } from "@/components/chat/MessageList";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConsole } from "@/hooks/useConsole";
import type { ConsoleList } from "@/lib/types";
import { ConsoleFilters } from "./ConsoleFilters";
import { ConsoleRail } from "./ConsoleRail";
import { ConsoleSearch } from "./ConsoleSearch";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationList } from "./ConversationList";
import { TakeoverBar } from "./TakeoverBar";
import { TicketPanel } from "./TicketPanel";
import { TransferSummary } from "./TransferSummary";

export function ConsoleScreen({ analyst, initialList, initialSelected }: { analyst: { id: string; name: string }; initialList: ConsoleList; initialSelected: string | null }) {
  const consoleState = useConsole(initialList, initialSelected);
  const { snapshot } = consoleState;

  return (
    <div className="flex h-full bg-paper">
      <ConsoleRail analystName={analyst.name} waiting={consoleState.list.counts.para_voce} />

      <section className="flex h-full w-[380px] shrink-0 flex-col border-r border-rule" aria-label="Conversas">
        <div className="flex flex-col gap-3 px-4 pb-[10px] pt-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-[-0.3px] text-ink">Conversas</h1>
            <span className="flex items-center gap-[6px] rounded-full bg-success-soft px-[10px] py-[5px] text-[12.5px] font-semibold text-success-text">
              <span className="h-[7px] w-[7px] rounded-full bg-success" />
              Disponível
            </span>
          </div>
          <ConsoleSearch value={consoleState.query} onChange={consoleState.setQuery} />
          <ConsoleFilters value={consoleState.filter} counts={consoleState.list.counts} onChange={consoleState.setFilter} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          <ConversationList items={consoleState.list.items} loading={consoleState.listLoading} selectedId={consoleState.selectedId} onSelect={consoleState.select} />
        </div>
      </section>

      <section className="flex h-full min-w-0 flex-1 flex-col bg-canvas" aria-label="Conversa">
        {!consoleState.selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-3">
            <MessagesSquare size={28} />
            <p className="text-[14.5px]">Escolha uma conversa para ver o histórico.</p>
          </div>
        ) : !snapshot ? (
          <div className="flex flex-1 flex-col gap-4 p-10" aria-busy>
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-16 w-1/2" />
          </div>
        ) : (
          <>
            <ConversationHeader snapshot={snapshot} analystId={analyst.id} busy={consoleState.busy} onReturn={consoleState.giveBack} onClose={consoleState.close} />
            <MessageList
              variant="console"
              bundles={[{ conversation: snapshot.conversation, messages: snapshot.messages, drafts: snapshot.drafts }]}
              currentId={snapshot.conversation.id}
              live={consoleState.live}
              header={<TransferSummary snapshot={snapshot} />}
            />
            <TakeoverBar
              snapshot={snapshot}
              analystId={analyst.id}
              busy={consoleState.busy}
              onTake={consoleState.take}
              onReturn={consoleState.giveBack}
              onSend={consoleState.send}
            />
          </>
        )}
      </section>

      <TicketPanel snapshot={snapshot} onRetry={() => void consoleState.reloadConversation()} />
    </div>
  );
}
