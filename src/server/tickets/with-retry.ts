import { logger } from "../logger";
import { TicketServiceUnavailableError } from "./errors";
import type { TicketService } from "./service";

export interface RetryOptions {
  /** Esperas antes de cada nova tentativa: 3 novas tentativas após a primeira (FR-026). */
  delays?: number[];
  sleep?: (ms: number) => Promise<void>;
}

export interface Attempted<T> {
  value: T;
  attempts: number;
}

export const DEFAULT_RETRY_DELAYS = [500, 1500, 3000];

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Executa `operation`, repetindo só em TicketServiceUnavailableError. */
export async function retrying<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<Attempted<T>> {
  const delays = options.delays ?? DEFAULT_RETRY_DELAYS;
  const sleep = options.sleep ?? realSleep;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      return { value: await operation(), attempts };
    } catch (error) {
      if (!(error instanceof TicketServiceUnavailableError)) throw error;
      const delay = delays[attempts - 1];
      if (delay === undefined) {
        logger.warn("tickets_retry_exhausted", { attempts });
        throw new TicketServiceUnavailableError(error.message, attempts);
      }
      logger.warn("tickets_retry", { attempt: attempts, delayMs: delay });
      await sleep(delay);
    }
  }
}

/** TicketService com novas tentativas; `attempt` expõe quantas tentativas foram feitas (passo do agent). */
export interface RetryingTicketService extends TicketService {
  attempt<T>(operation: (service: TicketService) => Promise<T>): Promise<Attempted<T>>;
}

export function withRetry(service: TicketService, options: RetryOptions = {}): RetryingTicketService {
  const run = <T>(operation: () => Promise<T>) => retrying(operation, options).then((r) => r.value);
  return {
    attempt: (operation) => retrying(() => operation(service), options),
    listByRequester: (...args) => run(() => service.listByRequester(...args)),
    get: (...args) => run(() => service.get(...args)),
    getWithEvents: (...args) => run(() => service.getWithEvents(...args)),
    create: (...args) => run(() => service.create(...args)),
    addNote: (...args) => run(() => service.addNote(...args)),
    reopen: (...args) => run(() => service.reopen(...args)),
    registerTransfer: (...args) => run(() => service.registerTransfer(...args)),
    setStatus: (...args) => run(() => service.setStatus(...args)),
  };
}
