import { describe, expect, it } from "vitest";
import { canReopen } from "./reopen-window";

const now = new Date("2026-10-26T13:00:00Z");
const daysAgo = (days: number, extraMs = 0) => new Date(now.getTime() - days * 86_400_000 - extraMs);

describe("janela de reabertura (7 dias, inclusiva)", () => {
  it("resolvido há 4 dias reabre", () => expect(canReopen(daysAgo(4), now)).toBe(true));
  it("resolvido há exatamente 7 dias ainda reabre", () => expect(canReopen(daysAgo(7), now)).toBe(true));
  it("7 dias + 1 minuto não reabre", () => expect(canReopen(daysAgo(7, 60_000), now)).toBe(false));
  it("resolvido há 10 dias não reabre", () => expect(canReopen(daysAgo(10).toISOString(), now)).toBe(false));
  it("data futura (relógio inconsistente) não reabre", () => expect(canReopen(daysAgo(-1), now)).toBe(false));
});
