"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, newClientId } from "@/lib/api";
import type { ChatSnapshot, ConversationBundle, Decision, Draft, LiveStep, MessageView } from "@/lib/types";
import { useEventSource } from "./useEventSource";

export interface LiveTurn {
  text: string;
  steps: LiveStep[];
}

export interface OptimisticMessage {
  clientMessageId: string;
  text: string;
  createdAt: string;
}

function upsertMessage(bundle: ConversationBundle, message: MessageView): ConversationBundle {
  const existing = bundle.messages.findIndex((m) => m.id === message.id);
  const messages = [...bundle.messages];
  if (existing >= 0) messages[existing] = { ...messages[existing]!, ...message, decision: message.decision ?? messages[existing]!.decision };
  else messages.push(message);
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { ...bundle, messages };
}

function upsertDraft(bundle: ConversationBundle, draft: Draft): ConversationBundle {
  const others = bundle.drafts.filter((d) => d.id !== draft.id);
  return { ...bundle, drafts: [...others, draft] };
}

/** Estado do chat: snapshot do servidor + eventos SSE (passos e texto ao vivo) + ações do funcionário. */
export function useChat(initial: ChatSnapshot) {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState(initial);
  const [live, setLive] = useState<Record<string, LiveTurn>>({});
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventId = useRef(initial.lastEventId);

  const refresh = useCallback(async () => {
    try {
      const next = await api.get<ChatSnapshot>("/api/chat");
      lastEventId.current = Math.max(lastEventId.current, next.lastEventId);
      setSnapshot(next);
      const finished = new Set(next.conversations.flatMap((c) => c.messages.filter((m) => m.status !== "pending").map((m) => m.id)));
      setLive((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !finished.has(id))));
      const known = new Set(next.conversations.flatMap((c) => c.messages.map((m) => m.clientMessageId).filter(Boolean)));
      setOptimistic((current) => current.filter((m) => !known.has(m.clientMessageId)));
    } catch {
      // mantém o estado atual; o próximo evento tenta de novo
    }
  }, []);

  const scheduleRefresh = useCallback(
    (delay = 250) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refresh(), delay);
    },
    [refresh],
  );

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  // Reserva para quando o SSE não entrega (ex.: deploy serverless com mais de uma instância).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const applyMessage = useCallback(
    (conversationId: string, message: MessageView) => {
      let known = true;
      setSnapshot((current) => {
        const index = current.conversations.findIndex((c) => c.conversation.id === conversationId);
        if (index < 0) {
          known = false;
          return current;
        }
        const conversations = [...current.conversations];
        conversations[index] = upsertMessage(conversations[index]!, message);
        return { ...current, conversations };
      });
      if (message.clientMessageId) setOptimistic((current) => current.filter((m) => m.clientMessageId !== message.clientMessageId));
      if (message.status === "done" || message.status === "error") {
        setLive((current) => {
          const { [message.id]: _done, ...rest } = current;
          void _done;
          return rest;
        });
        scheduleRefresh();
      }
      if (!known) scheduleRefresh(0);
    },
    [scheduleRefresh],
  );

  useEventSource(
    "/api/chat/events",
    {
      message: (data, id) => {
        if (id && id <= lastEventId.current) return;
        const message = data.message as MessageView | undefined;
        if (!message) return;
        const decision = (data.decision as Decision | undefined) ?? null;
        const author = (data.author as MessageView["author"] | undefined) ?? null;
        applyMessage(String(data.conversationId), { ...message, decision: decision ?? message.decision ?? null, author: author ?? message.author ?? null });
      },
      text_delta: (data) => {
        const messageId = String(data.messageId);
        setLive((current) => ({ ...current, [messageId]: { steps: current[messageId]?.steps ?? [], text: (current[messageId]?.text ?? "") + String(data.delta ?? "") } }));
      },
      step: (data) => {
        const messageId = String(data.messageId);
        const step = data.step as LiveStep;
        setLive((current) => {
          const turn = current[messageId] ?? { text: "", steps: [] };
          const steps = turn.steps.some((s) => s.id === step.id) ? turn.steps.map((s) => (s.id === step.id ? step : s)) : [...turn.steps, step];
          return { ...current, [messageId]: { ...turn, steps } };
        });
      },
      draft: (data) => {
        const draft = data.draft as Draft;
        setSnapshot((current) => ({
          ...current,
          conversations: current.conversations.map((c) => (c.conversation.id === draft.conversationId ? upsertDraft(c, draft) : c)),
        }));
      },
      state: () => scheduleRefresh(0),
      conversation: () => scheduleRefresh(0),
      decision: () => scheduleRefresh(),
    },
    () => void refresh(),
  );

  const current = useMemo(
    () => snapshot.conversations.find((c) => c.conversation.id === snapshot.currentId) ?? null,
    [snapshot],
  );
  const responding = Boolean(current?.messages.some((m) => m.authorType === "agent" && m.status === "pending"));

  const send = useCallback(
    async (text: string) => {
      const clientMessageId = newClientId();
      setOptimistic((list) => [...list, { clientMessageId, text, createdAt: new Date().toISOString() }]);
      try {
        await api.post("/api/chat/messages", { text, clientMessageId });
      } catch (error) {
        setOptimistic((list) => list.filter((m) => m.clientMessageId !== clientMessageId));
        toast(error instanceof ApiError ? error.message : "Não foi possível enviar.", "error");
        if (error instanceof ApiError && error.code === "limit_reached") void refresh();
        return false;
      }
      scheduleRefresh(150);
      return true;
    },
    [refresh, scheduleRefresh, toast],
  );

  const retry = useCallback(
    async (messageId: string) => {
      try {
        await api.post(`/api/chat/messages/${messageId}/retry`);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : "Não foi possível tentar de novo.", "error");
      }
      scheduleRefresh(100);
    },
    [scheduleRefresh, toast],
  );

  const decideDraft = useCallback(
    async (draftId: string, action: "confirm" | "cancel") => {
      setBusy(`${action}:${draftId}`);
      setDraftErrors((errors) => ({ ...errors, [draftId]: "" }));
      try {
        await api.post(`/api/drafts/${draftId}/${action}`);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Algo deu errado. Tente de novo.";
        setDraftErrors((errors) => ({ ...errors, [draftId]: message }));
      } finally {
        setBusy(null);
        void refresh();
      }
    },
    [refresh],
  );

  const continueConversation = useCallback(async () => {
    setBusy("continue");
    try {
      await api.post("/api/chat/continue");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Não foi possível continuar.", "error");
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [refresh, toast]);

  const transferAtLimit = useCallback(async () => {
    setBusy("transfer");
    try {
      await api.post("/api/chat/transfer");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Não foi possível chamar um analista.", "error");
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [refresh, toast]);

  return {
    snapshot,
    current,
    live,
    optimistic,
    draftErrors,
    busy,
    responding,
    send,
    retry,
    confirmDraft: (id: string) => decideDraft(id, "confirm"),
    cancelDraft: (id: string) => decideDraft(id, "cancel"),
    continueConversation,
    transferAtLimit,
  };
}
