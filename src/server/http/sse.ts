import { logger } from "../logger";
import type { BusEvent, EventBus } from "../events/bus";

export interface SseOptions {
  lastEventId?: string | null;
  signal?: AbortSignal;
  heartbeatMs?: number;
}

const encoder = new TextEncoder();

export function formatSse(event: Pick<BusEvent, "id" | "type" | "data">): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** Resposta SSE ligada a um canal do barramento, com heartbeat e replay a partir de Last-Event-ID. */
export function sseResponse(bus: EventBus, channel: string, options: SseOptions = {}): Response {
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const unsubscribe = bus.subscribe(channel, (event) => send(formatSse(event)));
      const heartbeat = setInterval(() => send(`event: heartbeat\ndata: {}\n\n`), heartbeatMs);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        logger.info("sse_disconnected", { channel });
        try {
          controller.close();
        } catch {
          // já fechado pelo cliente
        }
      };
      cleanup = close;
      options.signal?.addEventListener("abort", close, { once: true });

      logger.info("sse_connected", { channel });
      send(`retry: 2000\nevent: heartbeat\ndata: {}\n\n`);
      const last = Number(options.lastEventId);
      if (Number.isFinite(last) && last > 0) {
        for (const event of bus.since(channel, last)) send(formatSse(event));
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
