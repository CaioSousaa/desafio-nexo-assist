import { LocalTicketService, type LocalTicketServiceOptions } from "./local-service";
import { withRetry, type RetryOptions, type RetryingTicketService } from "./with-retry";

export type { TicketService } from "./service";
export type { RetryingTicketService, Attempted } from "./with-retry";
export type { Ticket, TicketEvent, TicketWithEvents, CreateTicketInput } from "./types";
export { VIA_NEXO_ASSIST } from "./types";
export { TicketServiceUnavailableError, TicketNotFoundError, InvalidTicketOperationError } from "./errors";
export { LocalTicketService } from "./local-service";

export interface TicketModule {
  /** Cliente com novas tentativas, usado pelo agent, pelos rascunhos e pelo console. */
  service: RetryingTicketService;
  /** Implementação local (carga de exemplo, contagem, fechamento). */
  local: LocalTicketService;
}

/** Fábrica do serviço de chamados: LocalTicketService (banco próprio) decorado com withRetry. */
export async function openTicketModule(
  path: string,
  options: LocalTicketServiceOptions & { retry?: RetryOptions } = {},
): Promise<TicketModule> {
  const local = await LocalTicketService.open(path, options);
  return { local, service: withRetry(local, options.retry) };
}
