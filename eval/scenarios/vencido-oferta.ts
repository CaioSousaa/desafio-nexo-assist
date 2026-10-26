import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "vencido-oferta",
  title: "Chamado vencido: oferece analista e só transfere se aceitar (US4.2, US7.4)",
  tags: ["us4", "us7"],
  category: "vencido",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "e o INC-20311, como está?" },
      expect: { ticketCard: { number: "INC-20311", overdue: true }, optionsInclude: ["Falar com um analista"], transfer: false },
    },
    { input: { user: "Falar com um analista" }, expect: { action: "transferir", transfer: ["vencido", "pedido"] } },
  ],
};
