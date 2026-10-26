// Importável só dentro de src/server/tickets (regra no-restricted-imports em eslint.config.mjs).
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { openSqlite, type SqliteHandle } from "../db/client";
import * as schema from "./schema";

export type TicketsDb = LibSQLDatabase<typeof schema>;

export async function createTicketsDb(path: string): Promise<SqliteHandle<TicketsDb>> {
  const { client, path: absolute } = await openSqlite(path);
  const db = drizzle(client, { schema });
  return { db, client, path: absolute, close: () => client.close() };
}
