import type { Scenario } from "../types";
import { resolveTickets } from "./fixtures";

export const scenario: Scenario = {
  id: "status-0",
  title: "Sem chamados abertos: informa e oferece abrir (US4.4)",
  tags: ["us4"],
  category: "consulta",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: (ctx) => resolveTickets(ctx, ["INC-20311", "INC-20298", "REQ-10442"]),
  turns: [
    {
      input: { user: "qual o status do meu chamado?" },
      expect: { action: ["consultar_chamados", "pedir_esclarecimento"], noTicketList: true, noTicketCard: true, textIncludesAny: ["não há", "nenhum", "não tem", "não encontrei"], transfer: false },
    },
  ],
};
