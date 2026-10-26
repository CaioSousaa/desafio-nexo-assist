import { relativeTime } from "@/lib/format";
import { canReopen } from "../../rules/reopen-window";
import { isOverdue, slaInfo } from "../../rules/sla";
import { TicketServiceUnavailableError, type Ticket } from "../../tickets";
import type { TicketCard, TicketSummary } from "../../messages/repo";

export const UNAVAILABLE = {
  error: "tickets_unavailable",
  message: "O sistema de chamados está instável; tente em instantes.",
} as const;

/** Converte indisponibilidade do serviço em resultado de ferramenta (o modelo explica ao funcionário). */
export async function guardTickets<T extends object>(
  operation: () => Promise<T>,
): Promise<T | (typeof UNAVAILABLE & { attempts: number })> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TicketServiceUnavailableError) return { ...UNAVAILABLE, attempts: error.attempts };
    throw error;
  }
}

export function toSummary(ticket: Ticket, now: Date): TicketSummary {
  return {
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    overdue: isOverdue(ticket, now),
  };
}

export function toCard(ticket: Ticket, now: Date): TicketCard {
  const sla = slaInfo(ticket, now);
  return {
    ...toSummary(ticket, now),
    kind: ticket.kind,
    description: ticket.description,
    affected: ticket.affected,
    resolvedAt: ticket.resolvedAt,
    deadlineAt: sla.deadlineAt,
    lastUpdateText: sla.lastUpdateText,
    overdueByText: sla.overdueByText,
    ruleText: sla.ruleText,
  };
}

/** Visão do chamado para o modelo: só o necessário para decidir. */
export function toModelTicket(ticket: Ticket, now: Date) {
  return {
    number: ticket.number,
    title: ticket.title,
    kind: ticket.kind,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastUpdate: relativeTime(ticket.updatedAt, now),
    resolvedAt: ticket.resolvedAt,
    overdue: isOverdue(ticket, now),
    canReopen: ticket.status === "resolvido" && ticket.resolvedAt !== null && canReopen(ticket.resolvedAt, now),
  };
}
