import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "sem-artigo-oferece",
  title: "Pergunta sem artigo: diz que não achou e oferece chamado ou analista (US2.4)",
  tags: ["us2"],
  category: "dúvida",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "Qual é a política da empresa para usar pendrive no notebook?" },
      expect: {
        action: ["pedir_esclarecimento", "responder_central"],
        noDraft: true,
        noTicketCreated: true,
        transfer: false,
        textIncludesAny: ["chamado", "analista"],
      },
    },
  ],
};
