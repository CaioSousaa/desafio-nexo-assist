import type { Scenario } from "../types";

export const scenario: Scenario = {
  id: "baixa-confianca",
  title: "Mensagem vaga: pergunta com segurança ou transfere por baixa confiança (US7.3)",
  tags: ["us7"],
  category: "baixa confiança",
  employeeEmail: "ana.souza@nexo.com.br",
  turns: [
    {
      input: { user: "aquilo lá de ontem voltou, sabe? de novo aquela coisa" },
      expect: {
        noTicketCreated: true,
        custom: (o) => {
          const d = o.decision;
          if (!d) return "sem decisão";
          if ((d.action === "propor_chamado" || d.action === "propor_atualizacao" || d.action === "propor_reabertura") && d.confidence < 60) {
            return `propôs chamado com confiança ${d.confidence}`;
          }
          if (d.action === "pedir_esclarecimento" && d.confidence >= 60) return null;
          if (o.conversation.transferReason === "baixa_confianca" && (o.conversation.transferConfidence ?? 100) < 60) return null;
          if (d.action === "pedir_esclarecimento") return null;
          return `ação ${d.action} com confiança ${d.confidence}`;
        },
      },
    },
  ],
};
