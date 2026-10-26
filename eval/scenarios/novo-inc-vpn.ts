import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "novo-inc-vpn",
  title: "Novo INC da VPN: pergunta só o que falta e monta o rascunho Alta (US3.1–3.3)",
  tags: ["us3"],
  category: "novo INC",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "Meu notebook não conecta na VPN desde ontem. Erro 809." },
      expect: {
        action: "pedir_esclarecimento",
        toolsCalled: ["list_my_tickets", "search_help_center"],
        optionsInclude: ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"],
        noTicketCreated: true,
        transfer: false,
      },
    },
    {
      input: { user: "Só eu. Tenho reunião com cliente às 14h." },
      expect: {
        action: "propor_chamado",
        draft: { kind: "novo", type: "INC", category: "Rede e VPN", priority: "Alta", affected: "somente_voce" },
        noTicketCreated: true,
        transfer: false,
      },
    },
    { input: { confirmDraft: true }, expect: { ticketsCreated: 1, textIncludesAny: ["INC-"] } },
  ],
};
