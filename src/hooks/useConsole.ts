"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, newClientId } from "@/lib/api";
import type { ConsoleConversationSnapshot, ConsoleFilter, ConsoleList, LiveStep } from "@/lib/types";
import type { LiveTurn } from "./useChat";
import { useEventSource } from "./useEventSource";

/** Estado do console: lista com filtros/busca, conversa aberta (?c=) e ações, com atualização por SSE (FR-059). */
export function useConsole(initialList: ConsoleList, initialSelected: string | null) {
  const toast = useToast();
  const [filter, setFilter] = useState<ConsoleFilter>("todas");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ConsoleList>(initialList);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [snapshot, setSnapshot] = useState<ConsoleConversationSnapshot | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [live, setLive] = useState<Record<string, LiveTurn>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const listTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterRef = useRef({ filter: "todas" as ConsoleFilter, query: "" });
  const selectedRef = useRef(initialSelected);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter: filterRef.current.filter });
    if (filterRef.current.query.trim()) params.set("q", filterRef.current.query.trim());
    try {
      setList(await api.get<ConsoleList>(`/api/console/conversations?${params}`));
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string | null = selectedRef.current) => {
    if (!id) return;
    try {
      const next = await api.get<ConsoleConversationSnapshot>(`/api/console/conversations/${id}`);
      if (selectedRef.current !== id) return;
      setSnapshot(next);
      const finished = new Set(next.messages.filter((m) => m.status !== "pending").map((m) => m.id));
      setLive((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !finished.has(key))));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setSnapshot(null);
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const scheduleList = useCallback((delay = 200) => {
    if (listTimer.current) clearTimeout(listTimer.current);
    listTimer.current = setTimeout(() => void loadList(), delay);
  }, [loadList]);
  const scheduleConversation = useCallback((delay = 150) => {
    if (convTimer.current) clearTimeout(convTimer.current);
    convTimer.current = setTimeout(() => void loadConversation(), delay);
  }, [loadConversation]);

  // filtro e busca em tempo real (FR-052)
  const changeFilter = useCallback(
    (next: ConsoleFilter) => {
      filterRef.current = { ...filterRef.current, filter: next };
      setFilter(next);
      setListLoading(true);
      scheduleList(0);
    },
    [scheduleList],
  );
  const changeQuery = useCallback(
    (next: string) => {
      filterRef.current = { ...filterRef.current, query: next };
      setQuery(next);
      setListLoading(true);
      scheduleList(150);
    },
    [scheduleList],
  );

  const select = useCallback(
    (id: string | null) => {
      selectedRef.current = id;
      setSelectedId(id);
      setSnapshot(null);
      setLive({});
      if (id) {
        setLoadingConversation(true);
        void loadConversation(id).then(() => scheduleList(0));
      }
    },
    [loadConversation, scheduleList],
  );

  // conversa aberta pela URL (?c=) na primeira carga
  const initialRef = useRef(initialSelected);
  useEffect(() => {
    if (initialRef.current) void loadConversation(initialRef.current);
  }, [loadConversation]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("c", selectedId);
    else url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  // Reserva para quando o SSE não entrega (deploy serverless com mais de uma instância).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadList();
      void loadConversation();
    }, 8_000);
    return () => clearInterval(timer);
  }, [loadList, loadConversation]);

  useEffect(() => () => {
    if (listTimer.current) clearTimeout(listTimer.current);
    if (convTimer.current) clearTimeout(convTimer.current);
  }, []);

  useEventSource(
    "/api/console/events",
    {
      conversation_updated: (data) => {
        scheduleList();
        if (data.conversationId === selectedRef.current) scheduleConversation(400);
      },
    },
    () => {
      void loadList();
      void loadConversation();
    },
  );

  useEventSource(
    selectedId ? `/api/conversations/${selectedId}/events` : null,
    {
      text_delta: (data) => {
        const id = String(data.messageId);
        setLive((current) => ({ ...current, [id]: { steps: current[id]?.steps ?? [], text: (current[id]?.text ?? "") + String(data.delta ?? "") } }));
      },
      step: (data) => {
        const id = String(data.messageId);
        const step = data.step as LiveStep;
        setLive((current) => {
          const turn = current[id] ?? { text: "", steps: [] };
          const steps = turn.steps.some((s) => s.id === step.id) ? turn.steps.map((s) => (s.id === step.id ? step : s)) : [...turn.steps, step];
          return { ...current, [id]: { ...turn, steps } };
        });
      },
      message: () => scheduleConversation(),
      draft: () => scheduleConversation(),
      state: () => scheduleConversation(0),
    },
    () => void loadConversation(),
  );

  const act = useCallback(
    async (action: "take" | "return" | "close") => {
      const id = selectedRef.current;
      if (!id) return;
      setBusy(action);
      try {
        await api.post(`/api/console/conversations/${id}/${action}`);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : "Não foi possível concluir.", "error");
      } finally {
        setBusy(null);
        void loadConversation();
        void loadList();
      }
    },
    [loadConversation, loadList, toast],
  );

  const send = useCallback(
    async (text: string) => {
      const id = selectedRef.current;
      if (!id) return false;
      try {
        await api.post(`/api/console/conversations/${id}/messages`, { text, clientMessageId: newClientId() });
        void loadConversation();
        return true;
      } catch (error) {
        toast(error instanceof ApiError ? error.message : "Não foi possível enviar.", "error");
        return false;
      }
    },
    [loadConversation, toast],
  );

  return {
    filter,
    setFilter: changeFilter,
    query,
    setQuery: changeQuery,
    list,
    listLoading,
    selectedId,
    select,
    snapshot,
    loadingConversation,
    live,
    busy,
    take: () => act("take"),
    giveBack: () => act("return"),
    close: () => act("close"),
    send,
    reloadConversation: () => loadConversation(),
  };
}
