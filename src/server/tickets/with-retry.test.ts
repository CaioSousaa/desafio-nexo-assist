import { describe, expect, it, vi } from "vitest";
import { TicketNotFoundError, TicketServiceUnavailableError } from "./errors";
import type { TicketService } from "./service";
import { retrying, withRetry } from "./with-retry";

function fakeSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
}

describe("retrying", () => {
  it("sucesso de primeira não espera", async () => {
    const { waits, sleep } = fakeSleep();
    const result = await retrying(async () => "ok", { sleep });
    expect(result).toEqual({ value: "ok", attempts: 1 });
    expect(waits).toEqual([]);
  });

  it("sucesso na 2ª tentativa informa attempts=2 e espera 500 ms", async () => {
    const { waits, sleep } = fakeSleep();
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TicketServiceUnavailableError())
      .mockResolvedValueOnce("ok");
    expect(await retrying(op, { sleep })).toEqual({ value: "ok", attempts: 2 });
    expect(waits).toEqual([500]);
  });

  it("falha persistente: 3 novas tentativas (500/1500/3000 ms) e relança com attempts", async () => {
    const { waits, sleep } = fakeSleep();
    const op = vi.fn(async () => {
      throw new TicketServiceUnavailableError();
    });
    const error = await retrying(op, { sleep }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TicketServiceUnavailableError);
    expect((error as TicketServiceUnavailableError).attempts).toBe(4);
    expect(op).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([500, 1500, 3000]);
  });

  it("não repete erros que não são de indisponibilidade", async () => {
    const { waits, sleep } = fakeSleep();
    const op = vi.fn(async () => {
      throw new TicketNotFoundError("INC-1");
    });
    await expect(retrying(op, { sleep })).rejects.toBeInstanceOf(TicketNotFoundError);
    expect(op).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it("usa relógio falso do vitest sem esperar de verdade", async () => {
    vi.useFakeTimers();
    try {
      const op = vi
        .fn<() => Promise<number>>()
        .mockRejectedValueOnce(new TicketServiceUnavailableError())
        .mockRejectedValueOnce(new TicketServiceUnavailableError())
        .mockResolvedValueOnce(42);
      const pending = retrying(op);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1500);
      await expect(pending).resolves.toEqual({ value: 42, attempts: 3 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withRetry", () => {
  it("decora todas as operações e expõe attempt()", async () => {
    const { sleep } = fakeSleep();
    let calls = 0;
    const base = {
      listByRequester: async () => {
        calls += 1;
        if (calls === 1) throw new TicketServiceUnavailableError();
        return [];
      },
    } as unknown as TicketService;
    const service = withRetry(base, { sleep });
    await expect(service.listByRequester("a@b.c")).resolves.toEqual([]);
    calls = 0;
    const attempted = await service.attempt((s) => s.listByRequester("a@b.c"));
    expect(attempted).toEqual({ value: [], attempts: 2 });
  });
});
