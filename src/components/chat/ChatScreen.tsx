"use client";

import { useCallback, useEffect, useState } from "react";
import { useChat } from "@/hooks/useChat";
import type { ChatSnapshot, Draft } from "@/lib/types";
import { ChatTopBar } from "./ChatTopBar";
import { Composer } from "./Composer";
import { EmployeeSidebar } from "./EmployeeSidebar";
import { MessageList } from "./MessageList";
import { QuickOptions } from "./QuickOptions";

const EDIT_HINT = "Diga o que quer mudar no rascunho";

function Welcome({ name, onPick }: { name: string; onPick: (text: string) => void }) {
  return (
    <div className="flex w-full flex-col items-start gap-[6px]">
      <span className="flex items-center gap-[6px]">
        <span className="text-[12.5px] font-semibold text-ink">Nexo Assist</span>
        <span className="rounded-[6px] bg-primary-soft px-[6px] py-[1px] text-[11px] font-semibold text-primary-text">IA</span>
      </span>
      <div className="flex max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] bg-paper px-4 py-3 outline outline-1 -outline-offset-1 outline-rule">
        <p className="text-[14.5px] leading-[22px] text-ink">
          Olá, {name.split(" ")[0]}! Sou o Nexo Assist, do service desk de TI. Respondo dúvidas pela central de ajuda, consulto e abro seus chamados (sempre com sua confirmação) e chamo um analista quando for preciso. Como posso ajudar?
        </p>
        <QuickOptions options={["Qual o status do meu chamado?", "Minha VPN não conecta", "Até que horas o suporte atende?"]} disabled={false} onPick={onPick} />
      </div>
    </div>
  );
}

export function ChatScreen({ user, initial }: { user: { name: string; email: string }; initial: ChatSnapshot }) {
  const chat = useChat(initial);
  const [focusSignal, setFocusSignal] = useState(0);
  const [editing, setEditing] = useState(false);
  const conversation = chat.current?.conversation ?? null;
  const state = conversation?.state ?? null;
  const pendingDraft = chat.current?.drafts.find((d) => d.status === "aguardando_confirmacao") ?? null;

  const send = useCallback(
    async (text: string) => {
      const ok = await chat.send(text);
      if (ok) setEditing(false);
      return ok;
    },
    [chat],
  );

  // ⌘↵ / Ctrl+Enter confirma o rascunho pendente.
  useEffect(() => {
    if (!pendingDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void chat.confirmDraft(pendingDraft.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDraft, chat]);

  const draftActions = (draft: Draft) =>
    draft.status === "aguardando_confirmacao"
      ? {
          onConfirm: () => void chat.confirmDraft(draft.id),
          onCancel: () => void chat.cancelDraft(draft.id),
          onEdit: () => {
            setEditing(true);
            setFocusSignal((n) => n + 1);
          },
          confirming: chat.busy === `confirm:${draft.id}`,
          cancelling: chat.busy === `cancel:${draft.id}`,
        }
      : null;

  const limitReached = Boolean(conversation?.limitReached && state === "com_agent");
  const placeholder = state === "aguardando_atendente" || state === "com_analista" ? "Escreva para o service desk…" : "Escreva para o Nexo…";

  return (
    <div className="flex h-full">
      <EmployeeSidebar user={user} active="chat" />
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatTopBar here="Atendimento" state={state} analystName={conversation?.assignedAnalyst?.name ?? chat.snapshot.analystName} />
        <MessageList
          variant="chat"
          bundles={chat.snapshot.conversations}
          currentId={chat.snapshot.currentId}
          live={chat.live}
          optimistic={chat.optimistic}
          actions={{
            send: (text) => void send(text),
            retry: (id) => void chat.retry(id),
            draftActions,
            draftError: (id) => chat.draftErrors[id] || null,
            limit: { onContinue: () => void chat.continueConversation(), onTransfer: () => void chat.transferAtLimit(), busy: chat.busy },
          }}
          empty={<Welcome name={user.name} onPick={(text) => void send(text)} />}
        />
        <div className="mx-auto w-full max-w-[848px] px-5 pb-[18px] pt-[10px]">
          <Composer
            placeholder={placeholder}
            hint={editing && pendingDraft ? EDIT_HINT : null}
            focusSignal={focusSignal}
            onSubmit={send}
            disabled={chat.responding}
            busyText={chat.responding ? "Nexo Assist está respondendo…" : null}
            lockedText={limitReached ? `Limite de ${chat.snapshot.counter.limit} mensagens atingido. Escolha uma opção acima.` : null}
            counter={state === "com_agent" || state === null ? chat.snapshot.counter : null}
          />
        </div>
      </main>
    </div>
  );
}
