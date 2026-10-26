import { dayKey } from "@/lib/format";

// Proteções de uso para o deploy público: limite por IP (janela deslizante) e teto diário de turnos.
// Em memória do processo: na Vercel vale por instância (modo demo); para limite global use o firewall da plataforma.

export interface RateDecision {
  ok: boolean;
  remaining: number;
  retryAfterS: number;
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Registra uma tentativa para `key` e diz se ainda cabe em `limit` por `windowMs`. limit 0 = sem limite. */
  hit(key: string, limit: number, windowMs: number): RateDecision {
    if (limit <= 0) return { ok: true, remaining: Number.POSITIVE_INFINITY, retryAfterS: 0 };
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return { ok: false, remaining: 0, retryAfterS: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(windowMs);
    return { ok: true, remaining: limit - recent.length, retryAfterS: 0 };
  }

  private prune(windowMs: number): void {
    const now = this.now();
    for (const [key, times] of this.hits) if (times.every((t) => now - t >= windowMs)) this.hits.delete(key);
  }
}

/** Contador diário (dia de São Paulo) com teto; 0 desliga. */
export class DailyCounter {
  private day = "";
  private count = 0;

  constructor(private readonly now: () => number = Date.now) {}

  take(limit: number): boolean {
    if (limit <= 0) return true;
    const today = dayKey(this.now());
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
    if (this.count >= limit) return false;
    this.count += 1;
    return true;
  }
}

/** IP do cliente atrás do proxy da Vercel (ou "local" em desenvolvimento). */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

const holder = globalThis as unknown as { __nexoLimits?: { requests: SlidingWindowLimiter; turns: DailyCounter } };

export function limits() {
  holder.__nexoLimits ??= { requests: new SlidingWindowLimiter(), turns: new DailyCounter() };
  return holder.__nexoLimits;
}
