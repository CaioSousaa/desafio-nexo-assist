type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const order: Record<Level | "silent", number> = { info: 1, warn: 2, error: 3, silent: 4 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info") as Level | "silent";
  return order[configured] ?? order.info;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}

function write(level: Level, event: string, base: Fields, fields: Fields): void {
  if (order[level] < threshold()) return;
  const entry: Fields = { ts: new Date().toISOString(), level, event, ...base };
  for (const [key, value] of Object.entries(fields)) entry[key] = serializeError(value);
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export interface Logger {
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

function createLogger(base: Fields): Logger {
  return {
    info: (event, fields = {}) => write("info", event, base, fields),
    warn: (event, fields = {}) => write("warn", event, base, fields),
    error: (event, fields = {}) => write("error", event, base, fields),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

export const logger: Logger = createLogger({});
