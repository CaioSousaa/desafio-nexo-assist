import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";

export const DECISION_ACTIONS = [
  "responder_central",
  "consultar_chamados",
  "propor_chamado",
  "propor_atualizacao",
  "propor_reabertura",
  "transferir",
  "redirecionar",
  "pedir_esclarecimento",
  "encerrar_resolvida",
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const recordDecisionInput = z.object({
  understanding: z.object({
    intent: z.string().min(1).describe("O que o funcionário quer, em linguagem simples"),
    entities: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional()
      .describe("Dados extraídos (ex.: erro=809, sistema=VPN, compromisso=reunião às 14h)"),
    assumptions: z.array(z.string()).optional().describe("Premissas assumidas sem o funcionário dizer"),
  }),
  action: z.enum(DECISION_ACTIONS),
  confidence: z.number().min(0).max(100).describe("Segurança de 0 a 100 de que esta é a ação certa"),
  rationale: z.string().min(1).describe("Por quê, em 2 a 3 frases simples"),
  rules: z.array(z.string()).optional().describe('Regras aplicadas, ex.: "RN-004 · sem duplicidade"'),
});
export type RecordDecisionInput = z.infer<typeof recordDecisionInput>;

export const recordDecisionTool = createTool({
  id: "record_decision",
  description:
    "Obrigatória uma vez por resposta, depois das demais ferramentas e antes do texto final: registra o que você entendeu, a ação, a confiança e o porquê.",
  inputSchema: recordDecisionInput,
  execute: async (input, context) => {
    const { scratch } = requireTurn(context);
    scratch.decisions.push(input);
    return { recorded: true };
  },
});
