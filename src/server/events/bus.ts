// Barramento de eventos em memória (um processo). Canais:
//   conversation:<id>  eventos de uma conversa (console e chat)
//   employee:<id>      mesmos eventos, para o chat do funcionário (sobrevive à troca de conversa)
//   console            avisos de mudança na lista de conversas

export type BusEventType =
  | "message"
  | "text_delta"
  | "step"
  | "decision"
  | "draft"
  | "state"
  | "conversation"
  | "conversation_updated"
  | "error"
  | "heartbeat";

export interface BusEvent {
  id: number;
  channel: string;
  type: BusEventType;
  data: unknown;
}

type Listener = (event: BusEvent) => void;

const REPLAY_SIZE = 200;

export class EventBus {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly sequences = new Map<string, number>();
  private readonly recent = new Map<string, BusEvent[]>();

  publish(channel: string, type: BusEventType, data: unknown): BusEvent {
    const id = (this.sequences.get(channel) ?? 0) + 1;
    this.sequences.set(channel, id);
    const event: BusEvent = { id, channel, type, data };
    const buffer = this.recent.get(channel) ?? [];
    buffer.push(event);
    if (buffer.length > REPLAY_SIZE) buffer.shift();
    this.recent.set(channel, buffer);
    for (const listener of this.listeners.get(channel) ?? []) {
      try {
        listener(event);
      } catch {
        // um assinante com defeito não derruba os demais
      }
    }
    return event;
  }

  subscribe(channel: string, listener: Listener): () => void {
    const set = this.listeners.get(channel) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(channel, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(channel);
    };
  }

  /** Último id publicado no canal (o snapshot devolve este número para o cliente descartar eventos antigos). */
  lastId(channel: string): number {
    return this.sequences.get(channel) ?? 0;
  }

  /** Eventos recentes depois de `afterId` (reconexão com Last-Event-ID). */
  since(channel: string, afterId: number): BusEvent[] {
    return (this.recent.get(channel) ?? []).filter((event) => event.id > afterId);
  }

  listenerCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }
}

export const channels = {
  conversation: (id: string) => `conversation:${id}`,
  employee: (id: string) => `employee:${id}`,
  console: "console",
} as const;

const globalBus = globalThis as unknown as { __nexoBus?: EventBus };

/** Singleton em globalThis para sobreviver ao HMR do `next dev`. */
export function getBus(): EventBus {
  globalBus.__nexoBus ??= new EventBus();
  return globalBus.__nexoBus;
}
