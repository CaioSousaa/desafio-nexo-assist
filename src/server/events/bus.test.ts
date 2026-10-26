import { describe, expect, it } from "vitest";
import { formatSse, sseResponse } from "../http/sse";
import { EventBus } from "./bus";

describe("EventBus", () => {
  it("numera eventos por canal e entrega só aos assinantes do canal", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    const off = bus.subscribe("conversation:1", (e) => seen.push(`${e.id}:${e.type}`));
    bus.publish("conversation:1", "message", {});
    bus.publish("conversation:2", "message", {});
    bus.publish("conversation:1", "state", {});
    off();
    bus.publish("conversation:1", "draft", {});
    expect(seen).toEqual(["1:message", "2:state"]);
    expect(bus.lastId("conversation:1")).toBe(3);
    expect(bus.lastId("conversation:2")).toBe(1);
    expect(bus.listenerCount("conversation:1")).toBe(0);
  });

  it("guarda eventos recentes para reconexão (Last-Event-ID)", () => {
    const bus = new EventBus();
    for (let i = 0; i < 5; i++) bus.publish("c", "text_delta", { i });
    expect(bus.since("c", 3).map((e) => e.id)).toEqual([4, 5]);
  });

  it("assinante que lança erro não impede os demais", () => {
    const bus = new EventBus();
    let delivered = 0;
    bus.subscribe("c", () => {
      throw new Error("boom");
    });
    bus.subscribe("c", () => (delivered += 1));
    bus.publish("c", "message", {});
    expect(delivered).toBe(1);
  });
});

describe("SSE", () => {
  it("formata id, event e data JSON", () => {
    expect(formatSse({ id: 7, type: "state", data: { state: "com_agent" } })).toBe(
      'id: 7\nevent: state\ndata: {"state":"com_agent"}\n\n',
    );
  });

  it("entrega eventos do canal, faz replay após Last-Event-ID e encerra no abort", async () => {
    const bus = new EventBus();
    bus.publish("employee:1", "message", { n: 1 });
    bus.publish("employee:1", "message", { n: 2 });
    const abort = new AbortController();
    const response = sseResponse(bus, "employee:1", { lastEventId: "1", signal: abort.signal, heartbeatMs: 60_000 });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const readSome = async () => {
      const { value } = await reader.read();
      text += decoder.decode(value);
    };
    await readSome(); // retry + heartbeat inicial
    await readSome(); // replay do evento 2
    expect(text).toContain('id: 2\nevent: message\ndata: {"n":2}');
    expect(text).not.toContain('data: {"n":1}');
    bus.publish("employee:1", "state", { s: "x" });
    await readSome();
    expect(text).toContain("event: state");
    abort.abort();
    expect(bus.listenerCount("employee:1")).toBe(0);
    const end = await reader.read();
    expect(end.done).toBe(true);
  });
});
