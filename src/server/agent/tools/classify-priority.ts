import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dayKey, formatDateTime, formatTime } from "@/lib/format";
import { IMPACTS, TICKET_KINDS } from "../../rules/catalog";
import { classifyPriority } from "../../rules/priority";
import { deadlineFor } from "../../rules/sla";
import { requireTurn } from "./context";

export const classificationSchema = z.object({
  kind: z.enum(TICKET_KINDS).describe("INC = algo parou/não funciona; REQ = pedido de acesso, equipamento ou software"),
  impact: z.enum(IMPACTS).describe('Quem é afetado: somente_voce, equipe, empresa ou desconhecido ("Não sei")'),
  blocksWork: z.boolean().describe("Impede o trabalho de quem é afetado"),
  sameDayCommitment: z.boolean().describe("Há compromisso no mesmo dia em risco (reunião, entrega, cliente)"),
  hasWorkaround: z.boolean().describe("Existe alternativa para seguir trabalhando"),
});

export function deadlineText(deadline: Date, now: Date): string {
  return dayKey(deadline) === dayKey(now) ? `resposta até ${formatTime(deadline)}` : `resposta até ${formatDateTime(deadline)}`;
}

export const classifyPriorityTool = createTool({
  id: "classify_priority",
  description:
    "Calcula a prioridade pela tabela do service desk (impacto + urgência) e o prazo da primeira resposta (SLA). A prioridade é sempre a calculada aqui.",
  inputSchema: classificationSchema,
  execute: async (input, context) => {
    const { app } = requireTurn(context);
    const now = app.now();
    const result = classifyPriority(input);
    const deadline = deadlineFor(result.priority, now);
    return {
      priority: result.priority,
      rule: result.rule,
      assumptions: result.assumptions,
      deadlineAt: deadline.toISOString(),
      deadlineText: deadlineText(deadline, now),
    };
  },
});
