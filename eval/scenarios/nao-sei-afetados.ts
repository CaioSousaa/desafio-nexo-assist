import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "nao-sei-afetados",
  title: '"Não sei" sobre afetados: assume "só você" e registra a premissa',
  tags: ["us3"],
  category: "novo INC",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    { input: { user: "O Excel trava toda vez que abro as planilhas grandes do fechamento." }, expect: { action: "pedir_esclarecimento", noTicketCreated: true } },
    {
      input: { user: "Não sei" },
      expect: { action: "propor_chamado", draft: { affected: "somente_voce", hasAssumptions: true }, minConfidence: 60, noTicketCreated: true, transfer: false },
    },
  ],
};
