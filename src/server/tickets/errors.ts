export class TicketServiceUnavailableError extends Error {
  constructor(
    message = "O serviço de chamados está indisponível no momento.",
    public attempts = 1,
  ) {
    super(message);
    this.name = "TicketServiceUnavailableError";
  }
}

export class TicketNotFoundError extends Error {
  constructor(public readonly number: string) {
    super(`Chamado ${number} não encontrado.`);
    this.name = "TicketNotFoundError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor(public readonly key: string, public readonly operation: string) {
    super(`Chave de idempotência ${key} já usada em outra operação (${operation}).`);
    this.name = "IdempotencyConflictError";
  }
}

export class InvalidTicketOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTicketOperationError";
  }
}
