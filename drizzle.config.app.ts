import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle/app",
  dbCredentials: { url: process.env.APP_DB_PATH ?? "./data/app.db" },
});
