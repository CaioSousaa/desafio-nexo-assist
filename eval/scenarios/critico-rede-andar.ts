import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "critico-rede-andar",
  title: "Caso crítico: rascunho Crítica, Confirmar cria e transfere (US3.8–3.9, FR-044)",
  tags: ["us3", "us7"],
  category: "crítico",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "A rede do andar inteiro caiu, ninguém do Financeiro consegue trabalhar." },
      expect: { action: "propor_chamado", draft: { priority: "Crítica" }, transfer: "critico", pendingTransfer: true, noTicketCreated: true },
    },
    {
      input: { confirmDraft: true },
      expect: {
        ticketsCreated: 1,
        custom: (o) => (o.conversation.state === "aguardando_atendente" && o.conversation.transferReason === "critico" ? null : `estado ${o.conversation.state}`),
      },
    },
  ],
};
