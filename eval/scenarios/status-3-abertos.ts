import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "status-3-abertos",
  title: "Status sem número com 3 abertos: lista e depois card vencido com opções (US4.1–4.2)",
  tags: ["us4"],
  category: "consulta",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    { input: { user: "qual o status do meu chamado?" }, expect: { action: "consultar_chamados", ticketListCount: 3, toolsCalled: ["list_my_tickets"], transfer: false } },
    {
      input: { user: "INC-20311 · Notebook lento após atualização" },
      expect: {
        action: "consultar_chamados",
        ticketCard: { number: "INC-20311", overdue: true },
        optionsInclude: ["Falar com um analista", "Adicionar informação", "Não, obrigado"],
        transfer: false,
      },
    },
  ],
};
