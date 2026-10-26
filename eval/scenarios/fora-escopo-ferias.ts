import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "fora-escopo-ferias",
  title: "Assunto de RH é redirecionado, sem chamado nem transferência (US2.3)",
  tags: ["us2"],
  category: "fora de escopo",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "como peço férias?" },
      expect: { action: "redirecionar", noDraft: true, noTicketCreated: true, transfer: false, textIncludesAny: ["RH", "Pessoas"] },
    },
  ],
};
