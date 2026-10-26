import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "novo-req-monitor",
  title: "Pedido de equipamento vira REQ Baixa sem perguntar afetados (US3.7)",
  tags: ["us3"],
  category: "novo REQ",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "Preciso de um segundo monitor para trabalhar com as planilhas do fechamento." },
      expect: {
        action: "propor_chamado",
        draft: { type: "REQ", priority: "Baixa", affected: "somente_voce" },
        textExcludes: ["Quem está sendo afetado"],
        noTicketCreated: true,
        transfer: false,
      },
    },
  ],
};
