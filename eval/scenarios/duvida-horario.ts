import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "duvida-horario",
  title: "Dúvida respondida pela central de ajuda, sem chamado (US2.1)",
  tags: ["us2"],
  category: "dúvida",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "até que horas o suporte atende?" },
      expect: { action: "responder_central", articleTitle: "Horário do service desk", noDraft: true, noTicketCreated: true, transfer: false, textIncludesAny: ["18h", "18 h"] },
    },
  ],
};
