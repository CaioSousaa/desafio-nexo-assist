import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/tickets/schema.ts",
  out: "./drizzle/tickets",
  dbCredentials: { url: process.env.TICKETS_DB_PATH ?? "./data/tickets.db" },
});
