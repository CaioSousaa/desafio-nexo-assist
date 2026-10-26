// Horas e dias úteis do service desk: segunda a sexta, 08:00–18:00, America/Sao_Paulo, sem feriados.

export const BUSINESS_TZ = "America/Sao_Paulo";
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
export const BUSINESS_HOURS_PER_DAY = CLOSE_HOUR - OPEN_HOUR;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Diferença (ms) entre o relógio de São Paulo e UTC no instante dado. */
function tzOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** "Relógio local" representado como ms em UTC (campos UTC = campos de São Paulo). */
function toLocal(instant: number): number {
  return instant + tzOffsetMs(instant);
}

function fromLocal(local: number): number {
  const guess = local - tzOffsetMs(local);
  return local - tzOffsetMs(guess);
}

function startOfLocalDay(local: number): number {
  return Math.floor(local / DAY) * DAY;
}

function isWeekend(local: number): boolean {
  const day = new Date(local).getUTCDay();
  return day === 0 || day === 6;
}

/** Próximo instante dentro do expediente (o próprio instante se já estiver dentro). */
function nextBusinessLocal(local: number): number {
  let cursor = local;
  for (;;) {
    const dayStart = startOfLocalDay(cursor);
    const open = dayStart + OPEN_HOUR * HOUR;
    const close = dayStart + CLOSE_HOUR * HOUR;
    if (!isWeekend(cursor)) {
      if (cursor < open) return open;
      if (cursor < close) return cursor;
    }
    cursor = dayStart + DAY + OPEN_HOUR * HOUR;
    if (!isWeekend(cursor)) return cursor;
  }
}

export function nextBusinessMoment(from: Date): Date {
  return new Date(fromLocal(nextBusinessLocal(toLocal(from.getTime()))));
}

export function isBusinessTime(at: Date): boolean {
  const local = toLocal(at.getTime());
  return nextBusinessLocal(local) === local;
}

export function addBusinessHours(from: Date, hours: number): Date {
  let remaining = Math.round(hours * HOUR);
  let cursor = nextBusinessLocal(toLocal(from.getTime()));
  for (;;) {
    const close = startOfLocalDay(cursor) + CLOSE_HOUR * HOUR;
    const available = close - cursor;
    if (remaining <= available) return new Date(fromLocal(cursor + remaining));
    remaining -= available;
    cursor = nextBusinessLocal(close);
  }
}

/** N dias úteis = N expedientes completos (mesmo horário N dias úteis depois). */
export function addBusinessDays(from: Date, days: number): Date {
  return addBusinessHours(from, days * BUSINESS_HOURS_PER_DAY);
}

/** Horas úteis decorridas entre dois instantes (0 se `to` ≤ `from`). */
export function businessHoursBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let total = 0;
  let cursor = nextBusinessLocal(toLocal(from.getTime()));
  const end = toLocal(to.getTime());
  while (cursor < end) {
    const close = startOfLocalDay(cursor) + CLOSE_HOUR * HOUR;
    total += Math.min(close, end) - cursor;
    cursor = nextBusinessLocal(close);
  }
  return total / HOUR;
}
