// Datas e horas em pt-BR no fuso do service desk (America/Sao_Paulo). Usado no servidor e no navegador.

const TZ = "America/Sao_Paulo";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" });
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DateInput = Date | string | number;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** "10:05" */
export function formatTime(value: DateInput): string {
  return timeFormatter.format(toDate(value));
}

/** "16 out" */
export function formatDayShort(value: DateInput): string {
  return dayMonthFormatter.format(toDate(value)).replace(/\./g, "").replace(" de ", " ");
}

/** "16 out, 14:20" */
export function formatDateTime(value: DateInput): string {
  return `${formatDayShort(value)}, ${formatTime(value)}`;
}

/** "2026-10-26" no fuso de São Paulo (para agrupar por dia). */
export function dayKey(value: DateInput): string {
  return dayKeyFormatter.format(toDate(value));
}

/** "Hoje", "Ontem" ou "16 out". */
export function dayLabel(value: DateInput, now: DateInput = new Date()): string {
  const key = dayKey(value);
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(toDate(now).getTime() - 86_400_000)) return "Ontem";
  return formatDayShort(value);
}

/** "10:05" hoje, "ontem" ou "16 out" (lista do console). */
export function formatListTime(value: DateInput, now: DateInput = new Date()): string {
  const date = toDate(value);
  if (toDate(now).getTime() - date.getTime() < 60_000) return "agora";
  const label = dayLabel(date, now);
  if (label === "Hoje") return formatTime(date);
  if (label === "Ontem") return "ontem";
  return label;
}

/** "há 5 dias", "há 3 h", "há 12 min", "agora". Datas futuras: "em 2 h". */
export function relativeTime(value: DateInput, now: DateInput = new Date()): string {
  const diff = toDate(now).getTime() - toDate(value).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60_000);
  let text: string;
  if (minutes < 1) return "agora";
  if (minutes < 60) text = `${minutes} min`;
  else if (minutes < 24 * 60) text = `${Math.floor(minutes / 60)} h`;
  else {
    const days = Math.floor(minutes / (24 * 60));
    text = days === 1 ? "1 dia" : `${days} dias`;
  }
  return future ? `em ${text}` : `há ${text}`;
}

/** Dias inteiros desde a data (para "Alterada há N dias"). */
export function daysSince(value: DateInput, now: DateInput = new Date()): number {
  return Math.max(0, Math.floor((toDate(now).getTime() - toDate(value).getTime()) / 86_400_000));
}
