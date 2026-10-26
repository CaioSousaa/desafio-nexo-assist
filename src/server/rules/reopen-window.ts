export const REOPEN_WINDOW_DAYS = 7;
const DAY = 86_400_000;

/** Chamado resolvido há até 7 dias (inclusivo) pode ser reaberto em vez de abrir outro (Anexo A). */
export function canReopen(resolvedAt: string | Date, now: Date): boolean {
  const elapsed = now.getTime() - new Date(resolvedAt).getTime();
  return elapsed >= 0 && elapsed <= REOPEN_WINDOW_DAYS * DAY;
}
