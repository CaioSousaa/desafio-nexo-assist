import { logger } from "../logger";
import { TicketServiceUnavailableError } from "./errors";

export interface OutageOptions {
  /** Probabilidade (0–1) de cada chamada abrir uma janela de indisponibilidade. 0 desliga. */
  rate: number;
  /** Duração da janela, em segundos. */
  seconds: number;
  random?: () => number;
  now?: () => number;
}

/** Simula o legado que "fica indisponível por alguns segundos" (FR-102). */
export class OutageSimulator {
  private until = 0;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly options: OutageOptions) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  get rate(): number {
    return this.options.rate;
  }

  isDown(): boolean {
    return this.now() < this.until;
  }

  /** Lança TicketServiceUnavailableError se o serviço estiver (ou acabar de ficar) fora do ar. */
  check(): void {
    if (this.isDown()) throw new TicketServiceUnavailableError();
    if (this.options.rate > 0 && this.random() < this.options.rate) {
      this.until = this.now() + this.options.seconds * 1000;
      logger.warn("tickets_outage_started", { seconds: this.options.seconds });
      throw new TicketServiceUnavailableError();
    }
  }
}
