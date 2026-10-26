import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "eval/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      GEMINI_API_KEY: "test-key",
      SESSION_SECRET: "test-secret-with-enough-length",
      TICKETS_OUTAGE_RATE: "0",
      LOG_LEVEL: "silent",
      TZ: "UTC",
    },
  },
});
