import type { Scenario } from "../types";
import { conversationWithDraft } from "./fixtures";

export const scenario: Scenario = {
  id: "pedir-critica-sem-motivo",
  title: '"Coloca como Crítica" sem mudança de impacto/urgência mantém a prioridade (US3.5a)',
  tags: ["us3"],
  category: "edição",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: async (ctx, { conversation }) => conversationWithDraft(ctx, await conversation()),
  turns: [
    {
      input: { user: "coloca como Crítica" },
      expect: {
        noTicketCreated: true,
        textIncludesAny: ["impacto", "urgência", "afet"],
        custom: (o) => ((o.newDraft ?? o.pendingDraft)?.payload.priority === "Crítica" ? "aceitou Crítica sem mudança de impacto/urgência" : null),
      },
    },
  ],
};
