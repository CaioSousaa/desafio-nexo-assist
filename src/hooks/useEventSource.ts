"use client";

import { useEffect, useRef } from "react";

export type EventHandlers = Record<string, (data: Record<string, unknown>, id: number) => void>;

/**
 * Assina um endpoint SSE. O navegador reconecta sozinho (com Last-Event-ID); `onReconnect` avisa para
 * recarregar o snapshot, já que eventos podem ter sido perdidos enquanto a conexão caiu.
 */
export function useEventSource(url: string | null, handlers: EventHandlers, onReconnect?: () => void): void {
  const handlersRef = useRef(handlers);
  const reconnectRef = useRef(onReconnect);
  useEffect(() => {
    handlersRef.current = handlers;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!url) return;
    const source = new EventSource(url);
    let opened = false;
    let dropped = false;
    const types = ["message", "text_delta", "step", "decision", "draft", "state", "conversation", "conversation_updated", "error"];
    const listeners = types.map((type) => {
      const listener = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          handlersRef.current[type]?.(data, Number(event.lastEventId) || 0);
        } catch {
          // evento malformado: ignorado
        }
      };
      source.addEventListener(type, listener as EventListener);
      return [type, listener] as const;
    });
    source.onopen = () => {
      if (opened && dropped) reconnectRef.current?.();
      opened = true;
      dropped = false;
    };
    source.onerror = () => {
      dropped = true;
    };
    return () => {
      for (const [type, listener] of listeners) source.removeEventListener(type, listener as EventListener);
      source.close();
    };
  }, [url]);
}
