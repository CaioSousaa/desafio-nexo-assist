import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "reabertura-6d",
  title: "Resolvido há até 7 dias: propõe reabrir (US5.2)",
  tags: ["us5"],
  category: "reabertura",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "A senha do SAP bloqueou de novo, igual da outra vez." },
      expect: { action: "propor_reabertura", draft: { kind: "reabertura", targetTicket: "INC-20150" }, noTicketCreated: true },
    },
  ],
};
