import { z } from "zod";

const numberFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === "") return fallback;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({ code: "custom", message: `não é número: "${value}"` });
        return z.NEVER;
      }
      return parsed;
    });

const textWithDefault = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? fallback : value.trim()));

export const envSchema = z.object({
  GEMINI_API_KEY: z
    .string({ error: "obrigatória (chave do Google AI Studio)" })
    .trim()
    .min(1, "obrigatória (chave do Google AI Studio)"),
  GEMINI_MODEL: textWithDefault("gemini-3.5-flash-lite"),
  SESSION_SECRET: z
    .string({ error: "obrigatória, com pelo menos 16 caracteres" })
    .trim()
    .min(16, "obrigatória, com pelo menos 16 caracteres"),
  AGENT_CONFIDENCE_THRESHOLD: numberFromEnv(60).pipe(z.number().min(0).max(100)),
  AGENT_MESSAGE_LIMIT: numberFromEnv(30).pipe(z.number().int().min(1)),
  TICKETS_OUTAGE_RATE: numberFromEnv(0.1).pipe(z.number().min(0).max(1)),
  TICKETS_OUTAGE_SECONDS: numberFromEnv(4).pipe(z.number().min(0)),
  APP_DB_PATH: textWithDefault("./data/app.db"),
  TICKETS_DB_PATH: textWithDefault("./data/tickets.db"),
  EVAL_DELAY_MS: numberFromEnv(4000).pipe(z.number().int().min(0)),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(public readonly variables: string[], details: string) {
    super(`Variáveis de ambiente inválidas (veja .env.example):\n${details}`);
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const variables = result.error.issues.map((issue) => String(issue.path[0] ?? "?"));
    const details = result.error.issues
      .map((issue) => `  - ${String(issue.path[0] ?? "?")}: ${issue.message}`)
      .join("\n");
    throw new EnvError(variables, details);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lê e valida as variáveis na primeira chamada; módulos podem importar sem disparar a validação. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Acesso preguiçoso: `env.GEMINI_MODEL` valida tudo no primeiro uso. */
export const env: Env = new Proxy({} as Env, {
  get: (_target, key) => getEnv()[key as keyof Env],
});
