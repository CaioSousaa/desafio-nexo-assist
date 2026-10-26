import type { Scenario } from "../types";
import { resolveTickets } from "./fixtures";

export const scenario: Scenario = {
  id: "status-1-aberto",
  title: "Com 1 chamado aberto vai direto ao card (US4.3)",
  tags: ["us4"],
  category: "consulta",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: (ctx) => resolveTickets(ctx, ["INC-20298", "REQ-10442"]),
  turns: [{ input: { user: "como está o meu chamado?" }, expect: { action: "consultar_chamados", ticketCard: { number: "INC-20311" }, noTicketList: true } }],
};
