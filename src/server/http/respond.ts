import { ZodError } from "zod";
import { EnvError } from "@/env";
import { logger } from "../logger";
import { TicketServiceUnavailableError } from "../tickets/errors";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

/** Converte exceções conhecidas em respostas `{ error: { code, message } }` e loga o resto. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.code, error.message, error.status, error.extra);
    if (error instanceof ZodError) {
      return fail("invalid_input", error.issues[0]?.message ?? "Entrada inválida.", 400);
    }
    if (error instanceof TicketServiceUnavailableError) {
      return fail("tickets_unavailable", "O sistema de chamados está instável, tente em instantes.", 503);
    }
    if (error instanceof EnvError) {
      logger.error("env_invalid", { variables: error.variables });
      return fail("misconfigured", `Configuração incompleta no .env: ${error.variables.join(", ")}.`, 500);
    }
    logger.error("http_unhandled_error", { error });
    return fail("internal", "Algo deu errado. Tente de novo.", 500);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_input", "JSON inválido.");
  }
}
