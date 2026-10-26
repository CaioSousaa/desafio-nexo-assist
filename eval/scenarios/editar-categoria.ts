import type { Scenario } from "../types";
import { conversationWithDraft } from "./fixtures";

export const scenario: Scenario = {
  id: "editar-categoria",
  title: 'Edição pela conversa: "a categoria é Software" refaz o rascunho (US3.5)',
  tags: ["us3"],
  category: "edição",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: async (ctx, { conversation }) => conversationWithDraft(ctx, await conversation()),
  turns: [
    {
      input: { user: "a categoria é Software" },
      expect: { action: "propor_chamado", draft: { category: "Software", replacedPrevious: true }, noTicketCreated: true, toolsCalled: ["propose_draft"] },
    },
  ],
};
