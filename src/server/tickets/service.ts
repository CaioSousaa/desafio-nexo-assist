import type { Priority, TicketStatus } from "../rules/catalog";
import type { CreateTicketInput, Ticket, TicketEventKind, TicketWithEvents } from "./types";

export interface IdempotencyOptions {
  /** A mesma chave devolve o mesmo resultado sem repetir a escrita ("Confirmar" repetido). */
  idempotencyKey: string;
}

export interface ReadScope {
  /**
   * E-mail do funcionário dono da consulta. Leituras feitas pelo chat sempre informam;
   * chamado de outro solicitante volta como inexistente (FR-003). Omitido só pelo console do analista.
   */
  requesterEmail?: string;
}

export interface ListOptions {
  /** Inclui resolvidos a partir desta data; omitido = todos os chamados do solicitante. */
  resolvedSince?: Date;
}

/**
 * Contrato do serviço de chamados (sistema legado simulado). O agent e o console só falam com
 * chamados por esta interface; o banco tickets.db é privado do módulo.
 */
export interface TicketService {
  listByRequester(email: string, options?: ListOptions): Promise<Ticket[]>;
  get(number: string, scope: ReadScope): Promise<Ticket | null>;
  getWithEvents(number: string, scope: ReadScope): Promise<TicketWithEvents | null>;
  create(input: CreateTicketInput, options: IdempotencyOptions): Promise<Ticket>;
  addNote(
    number: string,
    note: { text: string; author: string; newPriority?: Priority },
    options: IdempotencyOptions,
  ): Promise<Ticket>;
  reopen(number: string, note: { text: string; author: string }, options: IdempotencyOptions): Promise<Ticket>;
  registerTransfer(
    number: string,
    transfer: { conversationId: string; reason: string; author: string },
  ): Promise<void>;
  setStatus(
    number: string,
    status: TicketStatus,
    note: { text: string; author: string; eventKind?: TicketEventKind },
  ): Promise<Ticket>;
}
