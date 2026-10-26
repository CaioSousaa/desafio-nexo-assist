import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "vencido-recusa",
  title: 'Chamado vencido + "Não, obrigado": não transfere',
  tags: ["us4", "us7"],
  category: "vencido",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    { input: { user: "qual a situação do INC-20311?" }, expect: { ticketCard: { number: "INC-20311", overdue: true }, transfer: false } },
    { input: { user: "Não, obrigado" }, expect: { transfer: false, noTicketCreated: true } },
  ],
};
