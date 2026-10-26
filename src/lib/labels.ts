// Rótulos compartilhados entre chat, console e servidor (textos do protótipo).

export type ConversationStateValue = "com_agent" | "aguardando_atendente" | "com_analista" | "encerrada";

/** Estado da conversa na barra superior do chat (FR-043). */
export function chatStateLabel(state: ConversationStateValue | null, analystName?: string | null): string {
  switch (state) {
    case "aguardando_atendente":
      return "Aguardando atendente";
    case "com_analista":
      return analystName ? `${analystName} está atendendo` : "Analista atendendo";
    case "encerrada":
      return "Atendimento encerrado";
    default:
      return "Assistente online";
  }
}

export const OUTCOME_LABELS: Record<string, string> = {
  resolvida_pelo_agent: "Resolvida pelo agent",
  encerrada_pelo_analista: "Encerrada pelo analista",
  limite_atingido: "Limite de mensagens",
};

export const TRANSFER_REASON_LABELS: Record<string, string> = {
  pedido: "Pedido do funcionário",
  critico: "Caso crítico",
  baixa_confianca: "Agent sem segurança",
  vencido: "Chamado com prazo vencido",
  limite: "Limite de mensagens",
};

/** "Decidi": ação em linguagem simples. */
export const ACTION_LABELS: Record<string, string> = {
  responder_central: "Responder com a central de ajuda",
  consultar_chamados: "Consultar seus chamados",
  propor_chamado: "Propor um chamado novo",
  propor_atualizacao: "Propor atualização de um chamado aberto",
  propor_reabertura: "Propor reabertura de um chamado resolvido",
  transferir: "Transferir para um analista",
  redirecionar: "Indicar o canal certo (fora de TI)",
  pedir_esclarecimento: "Perguntar o que falta",
  encerrar_resolvida: "Encerrar a conversa como resolvida",
  registrar_chamado: "Gravar o chamado confirmado",
  cancelar_rascunho: "Descartar o rascunho",
  avisar_transferencia: "Avisar sobre a transferência",
  retomar: "Retomar o atendimento",
  avisar_limite: "Avisar sobre o limite de mensagens",
  continuar_conversa: "Continuar em nova conversa",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  em_atendimento: "Em atendimento",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
};

export const AFFECTED_LABELS: Record<string, string> = {
  somente_voce: "Somente você",
  equipe: "Minha equipe",
  empresa: "Toda a empresa",
};

export const DRAFT_KIND_TITLES: Record<string, string> = {
  novo: "Novo chamado",
  atualizacao: "Atualizar chamado",
  reabertura: "Reabrir chamado",
};

export const DRAFT_STATUS_LABELS: Record<string, string> = {
  aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  substituido: "Substituído",
  expirado: "Expirado",
};

export const ANALYST_LEVEL_LABELS: Record<string, string> = { N1: "Suporte N1", N2: "Suporte N2" };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}
