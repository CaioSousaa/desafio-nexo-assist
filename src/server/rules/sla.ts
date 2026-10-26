import { relativeTime } from "@/lib/format";
import { addBusinessDays, addBusinessHours } from "./business-hours";
import { isOpenStatus, PRIORITY_SLA_TEXT, type Priority, type TicketStatus } from "./catalog";

const HOUR = 3_600_000;

/** Prazo da prioridade contado a partir de `from` (Crítica em horas corridas, demais em horas/dias úteis). */
export function deadlineFor(priority: Priority, from: Date): Date {
  switch (priority) {
    case "Crítica":
      return new Date(from.getTime() + HOUR);
    case "Alta":
      return addBusinessHours(from, 4);
    case "Média":
      return addBusinessDays(from, 3);
    case "Baixa":
      return addBusinessDays(from, 5);
  }
}

export interface SlaSubject {
  status: TicketStatus;
  priority: Priority;
  updatedAt: string | Date;
}

export interface SlaInfo {
  deadlineAt: string;
  overdue: boolean;
  /** "há 5 dias" (última atualização). */
  lastUpdateText: string;
  /** "Média: 3 dias úteis". */
  ruleText: string;
  /** "venceu há 2 dias" ou null quando no prazo. */
  overdueByText: string | null;
}

/**
 * Vencido = chamado não resolvido cuja última atualização é mais antiga que o prazo da prioridade.
 * O prazo em si ainda está no prazo (vence só depois dele). Mesmo cálculo no chat e no console (FR-103).
 */
export function isOverdue(subject: SlaSubject, now: Date): boolean {
  if (!isOpenStatus(subject.status)) return false;
  const deadline = deadlineFor(subject.priority, new Date(subject.updatedAt));
  return now.getTime() > deadline.getTime();
}

export function slaInfo(subject: SlaSubject, now: Date): SlaInfo {
  const updatedAt = new Date(subject.updatedAt);
  const deadline = deadlineFor(subject.priority, updatedAt);
  const overdue = isOverdue(subject, now);
  return {
    deadlineAt: deadline.toISOString(),
    overdue,
    lastUpdateText: relativeTime(updatedAt, now),
    ruleText: `${subject.priority}: ${PRIORITY_SLA_TEXT[subject.priority]}`,
    overdueByText: overdue ? `venceu ${relativeTime(deadline, now)}` : null,
  };
}
