import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";
import { guardTickets, toModelTicket } from "./shared";

export const listMyTicketsTool = createTool({
  id: "list_my_tickets",
  description:
    "Lista os chamados do funcionário desta conversa (abertos e resolvidos recentes), com status, prazo vencido (overdue) e se pode reabrir (canReopen). Use antes de propor chamado novo e para consultas de status.",
  inputSchema: z.object({
    includeResolvedDays: z.number().int().min(0).max(365).optional().describe("Inclui resolvidos nos últimos N dias (padrão 30)"),
  }),
  execute: async ({ includeResolvedDays }, context) => {
    const { app, employee, scratch } = requireTurn(context);
    const now = app.now();
    const days = includeResolvedDays ?? 30;
    return guardTickets(async () => {
      const { value, attempts } = await app.tickets.attempt((s) =>
        s.listByRequester(employee.email, { resolvedSince: new Date(now.getTime() - days * 86_400_000) }),
      );
      for (const ticket of value) scratch.tickets.set(ticket.number, ticket);
      return { tickets: value.map((t) => toModelTicket(t, now)), attempts };
    });
  },
});
