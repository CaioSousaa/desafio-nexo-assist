import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "pedido-analista",
  title: "Pedido explícito de analista transfere (US7.1)",
  tags: ["us7"],
  category: "pedido de analista",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [{ input: { user: "quero falar com um analista" }, expect: { action: "transferir", transfer: "pedido", noTicketCreated: true } }],
};
