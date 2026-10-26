import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { slaInfo } from "../../rules/sla";
import { requireTurn } from "./context";
import { guardTickets, toModelTicket } from "./shared";

export const getTicketTool = createTool({
  id: "get_ticket",
  description:
    "Busca um chamado do funcionário pelo número (INC-##### ou REQ-#####): detalhe, histórico recente e prazo (sla.overdue). Chamado de outra pessoa ou inexistente volta found=false.",
  inputSchema: z.object({ number: z.string().describe("Número do chamado, ex.: INC-20311") }),
  execute: async ({ number }, context) => {
    const { app, employee, scratch } = requireTurn(context);
    const now = app.now();
    const normalized = number.trim().toUpperCase();
    return guardTickets(async () => {
      const { value, attempts } = await app.tickets.attempt((s) =>
        s.getWithEvents(normalized, { requesterEmail: employee.email }),
      );
      if (!value) return { found: false as const, message: "Não encontrei esse chamado entre os seus.", attempts };
      scratch.tickets.set(value.ticket.number, value.ticket);
      scratch.focusTicket = value.ticket.number;
      scratch.mentionedTickets.add(value.ticket.number);
      const sla = slaInfo(value.ticket, now);
      return {
        found: true as const,
        ticket: { ...toModelTicket(value.ticket, now), description: value.ticket.description, affected: value.ticket.affected },
        sla: { ...sla, deadline: formatDateTime(sla.deadlineAt) },
        recentEvents: value.events.slice(-5).map((e) => ({ kind: e.kind, text: e.text, author: e.author, at: formatDateTime(e.createdAt) })),
        attempts,
      };
    });
  },
});
