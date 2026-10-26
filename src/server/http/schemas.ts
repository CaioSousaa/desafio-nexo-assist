import { z } from "zod";

import { MAX_MESSAGE_LENGTH } from "./schemas.constants";

export { MAX_MESSAGE_LENGTH };

export const messageInput = z.object({
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Escreva uma mensagem.").max(MAX_MESSAGE_LENGTH, "Máximo de 2.000 caracteres.")),
  clientMessageId: z.string().uuid(),
});
export type MessageInput = z.infer<typeof messageInput>;

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  remember: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginInput>;

export const CONSOLE_FILTERS = ["todas", "para_voce", "com_agent", "minhas"] as const;
export type ConsoleFilter = (typeof CONSOLE_FILTERS)[number];

export const consoleListQuery = z.object({
  filter: z.enum(CONSOLE_FILTERS).default("todas"),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
export type ConsoleListQuery = z.infer<typeof consoleListQuery>;
