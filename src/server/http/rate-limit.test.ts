import { describe, expect, it } from "vitest";
import { clientIp, DailyCounter, SlidingWindowLimiter } from "./rate-limit";

describe("limite por IP (janela deslizante)", () => {
  it("bloqueia acima do limite e libera quando a janela passa", () => {
    let now = 0;
    const limiter = new SlidingWindowLimiter(() => now);
    for (let i = 0; i < 3; i++) expect(limiter.hit("1.1.1.1", 3, 60_000).ok).toBe(true);
    const blocked = limiter.hit("1.1.1.1", 3, 60_000);
    expect(blocked).toMatchObject({ ok: false, remaining: 0 });
    expect(blocked.retryAfterS).toBe(60);
    expect(limiter.hit("2.2.2.2", 3, 60_000).ok).toBe(true); // outro IP não é afetado
    now = 60_000;
    expect(limiter.hit("1.1.1.1", 3, 60_000).ok).toBe(true);
  });

  it("limite 0 desliga", () => {
    const limiter = new SlidingWindowLimiter();
    for (let i = 0; i < 100; i++) expect(limiter.hit("x", 0, 1000).ok).toBe(true);
  });
});

describe("teto diário de turnos", () => {
  it("conta por dia de São Paulo e zera no dia seguinte", () => {
    let now = new Date("2026-10-26T15:00:00Z").getTime();
    const counter = new DailyCounter(() => now);
    expect(counter.take(2)).toBe(true);
    expect(counter.take(2)).toBe(true);
    expect(counter.take(2)).toBe(false);
    now = new Date("2026-10-27T03:30:00Z").getTime(); // 00:30 em São Paulo
    expect(counter.take(2)).toBe(true);
  });
});

describe("clientIp", () => {
  it("usa x-real-ip, depois o primeiro x-forwarded-for, depois 'local'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 10.0.0.1" } }))).toBe("1.1.1.1");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
