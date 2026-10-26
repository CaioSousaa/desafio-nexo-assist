import type { Scenario } from "../types";
import { addTicket } from "./fixtures";

export const scenario: Scenario = {
  id: "duplicado-vpn",
  title: "Chamado aberto sobre o mesmo problema: propõe atualização, nunca duplicado (US3.6, US5.1)",
  tags: ["us5"],
  category: "duplicado",
  employeeEmail: "ana.souza@nexo.com.br",
  setup: (ctx) =>
    addTicket(ctx, {
      number: "INC-20480",
      kind: "INC",
      title: "VPN não conecta (erro 809)",
      description: "Notebook Windows 11 não conecta na VPN; erro 809.",
      category: "Rede e VPN",
      priority: "Média",
      affected: "somente_voce",
      requesterEmail: "ana.souza@nexo.com.br",
      status: "aberto",
      createdDaysAgo: 1,
    }),
  turns: [
    {
      input: { user: "Minha VPN continua sem conectar, aparece o erro 809 de novo. Agora nem o Teams abre direito." },
      expect: {
        action: "propor_atualizacao",
        draft: { kind: "atualizacao", targetTicket: "INC-20480" },
        noTicketCreated: true,
        custom: (o) => (o.newDraft?.kind === "novo" ? "propôs chamado novo (duplicado)" : null),
      },
    },
  ],
};
