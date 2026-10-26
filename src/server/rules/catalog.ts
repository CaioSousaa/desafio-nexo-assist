// Catálogo do service desk (Anexo A + Anexo B + protótipo). Valores em pt-BR são os que o usuário vê.

export const TICKET_KINDS = ["INC", "REQ"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

export const CATEGORIES = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TICKET_STATUSES = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "em_atendimento",
  "aprovado",
  "resolvido",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const AFFECTED = ["somente_voce", "equipe", "empresa"] as const;
export type Affected = (typeof AFFECTED)[number];

export const IMPACTS = ["somente_voce", "equipe", "empresa", "desconhecido"] as const;
export type Impact = (typeof IMPACTS)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  em_atendimento: "Em atendimento",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
};

export const AFFECTED_LABELS: Record<Affected, string> = {
  somente_voce: "Somente você",
  equipe: "Minha equipe",
  empresa: "Toda a empresa",
};

export const PRIORITY_SLA_TEXT: Record<Priority, string> = {
  Crítica: "1 hora corrida",
  Alta: "4 horas úteis",
  Média: "3 dias úteis",
  Baixa: "5 dias úteis",
};

/** Chamado que ainda conta como aberto (pode vencer e pode receber atualização). */
export function isOpenStatus(status: TicketStatus): boolean {
  return status !== "resolvido";
}

export const TICKET_NUMBER_PATTERN = /\b(INC|REQ)-\d{5}\b/gi;

export function extractTicketNumbers(text: string): string[] {
  return [...new Set([...text.matchAll(TICKET_NUMBER_PATTERN)].map((m) => m[0].toUpperCase()))];
}
