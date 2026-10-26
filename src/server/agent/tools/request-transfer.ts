import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";

export const requestTransferTool = createTool({
  id: "request_transfer",
  description:
    'Pede a transferência para um analista com o resumo do caso. Motivos: "pedido" (o funcionário pediu), "critico" (caso Crítica), "vencido" (o funcionário aceitou falar com analista sobre chamado vencido), "baixa_confianca". A transferência acontece ao fim da resposta; em caso crítico com rascunho pendente, logo após Confirmar ou Cancelar.',
  inputSchema: z.object({
    reason: z.enum(["pedido", "critico", "vencido", "baixa_confianca"]),
    summary: z.object({
      problem: z.string().describe("Problema em uma frase"),
      done: z.string().describe("O que o agent já fez"),
      tickets: z.array(z.string()).describe("Chamados relacionados"),
      priority: z.string().optional(),
    }),
  }),
  execute: async ({ reason, summary }, context) => {
    const { scratch } = requireTurn(context);
    const tickets = summary.tickets.map((t) => t.trim().toUpperCase()).filter((t) => scratch.mentionedTickets.has(t) || scratch.tickets.has(t));
    scratch.transferRequest = { reason, summary: { problem: summary.problem, done: summary.done, tickets, priority: summary.priority ?? null } };
    return { scheduled: true, reason };
  },
});
