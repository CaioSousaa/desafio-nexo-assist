import type { Scenario } from "../types";
import { conversationWithDraft } from "./fixtures";

export const scenario: Scenario = {
  id: "obrigado-ambiguo",
  title: '"Obrigado" com rascunho pendente não encerra (US2.6)',
  tags: ["us2"],
  category: "encerramento",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: async (ctx, { conversation }) => conversationWithDraft(ctx, await conversation()),
  turns: [
    {
      input: { user: "obrigado" },
      expect: {
        closed: false,
        noTicketCreated: true,
        custom: (o) => (o.pendingDraft ? null : "o rascunho pendente sumiu"),
      },
    },
  ],
};
