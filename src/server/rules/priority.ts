import type { Impact, Priority, TicketKind } from "./catalog";

export interface PriorityInput {
  kind: TicketKind;
  impact: Impact;
  /** O funcionário (ou a equipe) não consegue trabalhar. */
  blocksWork: boolean;
  /** Há compromisso no mesmo dia em risco (reunião, entrega, cliente). */
  sameDayCommitment: boolean;
  /** Existe alternativa para seguir trabalhando. */
  hasWorkaround: boolean;
}

export interface PriorityResult {
  priority: Priority;
  /** Regra aplicada, em linguagem simples, para o rascunho e o detalhe da decisão. */
  rule: string;
  /** Premissas assumidas pelo cálculo (ex.: impacto desconhecido tratado como "só você"). */
  assumptions: string[];
}

/**
 * Tabela do Anexo A: prioridade = impacto (quantas pessoas) + urgência (compromisso em risco).
 * O modelo informa os fatos; a prioridade é sempre calculada aqui.
 */
export function classifyPriority(input: PriorityInput): PriorityResult {
  const assumptions: string[] = [];
  let impact = input.impact;
  if (impact === "desconhecido") {
    impact = "somente_voce";
    assumptions.push('Impacto desconhecido: considerado "só você".');
  }
  const many = impact === "equipe" || impact === "empresa";
  const who = impact === "empresa" ? "a empresa" : "uma equipe";
  const blocked = input.blocksWork && !input.hasWorkaround;

  if (input.kind === "INC") {
    if (many && input.blocksWork) {
      return { priority: "Crítica", rule: `Algo parado para ${who}: prioridade Crítica (1 hora corrida).`, assumptions };
    }
    if (many) {
      return { priority: "Alta", rule: `Afeta ${who}, mas há como seguir trabalhando: prioridade Alta (4 horas úteis).`, assumptions };
    }
    if (input.sameDayCommitment) {
      return { priority: "Alta", rule: "Afeta só você, com compromisso no mesmo dia: prioridade Alta (4 horas úteis).", assumptions };
    }
    if (blocked) {
      return { priority: "Alta", rule: "Afeta só você e impede o trabalho, sem alternativa: prioridade Alta (4 horas úteis).", assumptions };
    }
    return {
      priority: "Média",
      rule: input.hasWorkaround
        ? "Afeta só você e há alternativa para seguir trabalhando: prioridade Média (3 dias úteis)."
        : "Afeta só você, sem urgência declarada: prioridade Média (3 dias úteis).",
      assumptions,
    };
  }

  if (many && input.blocksWork) {
    return { priority: "Alta", rule: `Pedido que trava ${who}: prioridade Alta (4 horas úteis).`, assumptions };
  }
  if (input.blocksWork || input.sameDayCommitment) {
    return { priority: "Média", rule: "Pedido com urgência declarada: prioridade Média (3 dias úteis).", assumptions };
  }
  return { priority: "Baixa", rule: "Pedido de acesso, equipamento ou software sem urgência: prioridade Baixa (5 dias úteis).", assumptions };
}
