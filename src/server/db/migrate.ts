import { resolve } from "node:path";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export const MIGRATIONS = {
  app: resolve(process.cwd(), "drizzle/app"),
  tickets: resolve(process.cwd(), "drizzle/tickets"),
} as const;

/** Aplica as migrations versionadas; idempotente (drizzle registra o que já rodou). */
export async function migrateDb(
  db: LibSQLDatabase<Record<string, unknown>>,
  which: keyof typeof MIGRATIONS,
): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS[which] });
}
