import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "critico-cancelar",
  title: "Caso crítico cancelado: nada é criado, mas transfere com o resumo (US3.10, D5)",
  tags: ["us3", "us7"],
  category: "crítico",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "Caiu a internet da empresa toda, nenhum sistema abre." },
      expect: { action: "propor_chamado", draft: { priority: "Crítica" }, pendingTransfer: true, noTicketCreated: true },
    },
    {
      input: { cancelDraft: true },
      expect: {
        noTicketCreated: true,
        custom: (o) =>
          o.conversation.state === "aguardando_atendente" && o.conversation.transferSummary?.notConfirmed ? null : "não transferiu com 'não confirmou'",
      },
    },
  ],
};
