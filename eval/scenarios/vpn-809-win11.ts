import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "vpn-809-win11",
  title: "Artigo do erro 809 não vale para Windows 11 (US2.2)",
  tags: ["us2"],
  category: "dúvida",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "Estou com erro 809 na VPN, o que eu faço?" },
      expect: {
        action: ["propor_chamado", "pedir_esclarecimento"],
        toolsCalled: ["search_help_center"],
        textIncludesAny: ["Windows 11", "não se aplica", "não vale", "só para Windows 10", "apenas para Windows 10"],
        noTicketCreated: true,
        transfer: false,
      },
    },
  ],
};
