import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // O banco do serviço de chamados só pode ser aberto pelo próprio módulo (tech spec, T4).
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/server/tickets/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/tickets/db", "**/server/tickets/db.ts", "@/server/tickets/db"],
              message: "tickets.db pertence ao serviço de chamados; use TicketService.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "eval/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "data/**", "coverage/**"]),
]);

export default eslintConfig;
