import type { Scenario } from "../types";
import { addTicket } from "./fixtures";

export const scenario: Scenario = {
  id: "reabertura-10d",
  title: "Resolvido há mais de 7 dias: chamado novo citando o anterior (US5.3)",
  tags: ["us5"],
  category: "reabertura",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: (ctx) =>
    addTicket(ctx, {
      number: "INC-20060",
      kind: "INC",
      title: "Impressora do 3º andar não imprime",
      description: "Impressora Nexo-Print do 3º andar mostrava erro de bandeja.",
      category: "Hardware",
      priority: "Média",
      affected: "equipe",
      requesterEmail: "ana.souza@nexo.com.br",
      status: "resolvido",
      createdDaysAgo: 12,
      resolvedDaysAgo: 10,
    }),
  turns: [
    {
      input: { user: "A impressora do 3º andar parou de imprimir de novo, o mesmo erro de bandeja da outra vez. Só eu uso ela agora e dá para imprimir no 2º andar." },
      expect: { action: "propor_chamado", draft: { kind: "novo", descriptionIncludes: "INC-20060" }, noTicketCreated: true },
    },
  ],
};
