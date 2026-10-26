import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { TicketSummary } from "../../messages/repo";
import { requireTurn } from "./context";
import { guardTickets, toSummary } from "./shared";

export const offerTicketSelectionTool = createTool({
  id: "offer_ticket_selection",
  description: "Mostra uma lista selecionável de chamados do funcionário (número, título, status, data). Use com 2 ou mais abertos.",
  inputSchema: z.object({ numbers: z.array(z.string()).min(1).max(10) }),
  execute: async ({ numbers }, context) => {
    const { app, employee, scratch } = requireTurn(context);
    const now = app.now();
    return guardTickets(async () => {
      const items: TicketSummary[] = [];
      for (const raw of numbers) {
        const number = raw.trim().toUpperCase();
        // Só chamados do funcionário entram na lista (privacidade).
        const ticket = scratch.tickets.get(number) ?? (await app.tickets.get(number, { requesterEmail: employee.email }));
        if (!ticket || ticket.requesterEmail !== employee.email) continue;
        scratch.tickets.set(number, ticket);
        items.push(toSummary(ticket, now));
      }
      scratch.ticketList = items;
      return { shown: items.length, skipped: numbers.length - items.length };
    });
  },
});
