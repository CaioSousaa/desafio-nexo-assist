import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type AppDb = LibSQLDatabase<typeof schema>;

export interface SqliteHandle<TDb> {
  db: TDb;
  client: Client;
  path: string;
  close(): void;
}

/** Abre um arquivo SQLite com WAL e espera de lock; cria a pasta se preciso. */
export async function openSqlite(path: string): Promise<{ client: Client; path: string }> {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  // `timeout` vira o busy_timeout de cada conexão do pool do libsql.
  const client = createClient({ url: `file:${absolute}`, timeout: 5000 });
  await client.execute("PRAGMA journal_mode=WAL");
  return { client, path: absolute };
}

export async function createAppDb(path: string): Promise<SqliteHandle<AppDb>> {
  const { client, path: absolute } = await openSqlite(path);
  const db = drizzle(client, { schema });
  return { db, client, path: absolute, close: () => client.close() };
}
