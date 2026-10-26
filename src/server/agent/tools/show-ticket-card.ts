import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { requireTurn } from "./context";
import { guardTickets, toCard } from "./shared";

export const showTicketCardTool = createTool({
  id: "show_ticket_card",
  description: "Mostra o card completo de um chamado do funcionário (categoria, prioridade, aberto em, última atualização, prazo vencido).",
  inputSchema: z.object({ number: z.string() }),
  execute: async ({ number }, context) => {
    const { app, employee, scratch } = requireTurn(context);
    const normalized = number.trim().toUpperCase();
    return guardTickets(async () => {
      const ticket = scratch.tickets.get(normalized) ?? (await app.tickets.get(normalized, { requesterEmail: employee.email }));
      if (!ticket || ticket.requesterEmail !== employee.email) return { shown: false, message: "Não encontrei esse chamado entre os seus." };
      scratch.tickets.set(normalized, ticket);
      scratch.ticketCard = toCard(ticket, app.now());
      scratch.focusTicket = normalized;
      scratch.mentionedTickets.add(normalized);
      return { shown: true, overdue: scratch.ticketCard.overdue };
    });
  },
});
