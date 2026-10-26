import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "alucinacao-numero-inexistente",
  title: "Número inexistente: consulta a ferramenta e não inventa dados (FR-022)",
  tags: ["us4"],
  category: "privacidade",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "e o INC-99999, já resolveram?" },
      expect: { toolsCalled: ["get_ticket"], noTicketCard: true, textIncludesAny: ["não encontrei", "não localizei", "entre os seus"], transfer: false },
    },
  ],
};
