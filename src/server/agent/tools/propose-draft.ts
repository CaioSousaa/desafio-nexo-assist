import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { relateTickets } from "../../conversations/repo";
import { proposeDraft } from "../../drafts/service";
import { DRAFT_KINDS, type DraftPayload } from "../../drafts/repo";
import { CATEGORIES, TICKET_KINDS, type Affected, type Priority } from "../../rules/catalog";
import { classifyPriority } from "../../rules/priority";
import { canReopen } from "../../rules/reopen-window";
import { deadlineFor } from "../../rules/sla";
import { deadlineText } from "./classify-priority";
import { requireTurn } from "./context";
import { guardTickets } from "./shared";

export const DUPLICATE_VERDICTS = ["nenhum", "aberto_igual", "resolvido_recente", "resolvido_antigo", "diferente"] as const;

export const proposeDraftInput = z.object({
  kind: z.enum(DRAFT_KINDS).describe("novo | atualizacao (nota em chamado aberto) | reabertura (resolvido há até 7 dias)"),
  title: z.string().min(3).max(120).describe("Título curto do problema ou pedido"),
  description: z.string().min(3).max(2000).describe("Descrição completa com o que o funcionário contou (e o chamado anterior, se houver)"),
  type: z.enum(TICKET_KINDS),
  category: z.enum(CATEGORIES),
  affected: z.enum(["somente_voce", "equipe", "empresa", "desconhecido"]),
  classification: z
    .object({
      blocksWork: z.boolean(),
      sameDayCommitment: z.boolean(),
      hasWorkaround: z.boolean(),
    })
    .describe("Fatos de urgência; a prioridade é calculada pelo servidor"),
  targetTicket: z.string().optional().describe("Chamado alvo (obrigatório em atualizacao e reabertura)"),
  note: z.string().optional().describe("Texto da nota (atualizacao/reabertura)"),
  changesPriority: z.boolean().optional().describe("Em atualizacao: a novidade muda impacto ou urgência"),
  changes: z.string().optional().describe("Ao refazer um rascunho: o que mudou"),
  duplicateCheck: z.object({
    considered: z.array(z.string()).describe("Chamados do funcionário comparados"),
    verdict: z.enum(DUPLICATE_VERDICTS),
    why: z.string(),
  }),
});

export const proposeDraftTool = createTool({
  id: "propose_draft",
  description:
    "Monta (ou refaz) o rascunho que o funcionário confere e confirma. Não grava nada no serviço de chamados. Prioridade e prazo são calculados pelo servidor a partir de affected + classification.",
  inputSchema: proposeDraftInput,
  execute: async (input, context) => {
    const { app, employee, conversation, scratch } = requireTurn(context);
    const now = app.now();
    const impact = input.affected;
    const affected: Affected = impact === "desconhecido" ? "somente_voce" : impact;
    const computed = classifyPriority({ kind: input.type, impact, ...input.classification });

    if (input.kind === "novo" && input.duplicateCheck.verdict === "aberto_igual") {
      return {
        error: "duplicate_open_ticket",
        message: "Há chamado aberto sobre o mesmo problema: proponha atualização (kind atualizacao) em vez de chamado novo.",
      };
    }

    let payload: DraftPayload;
    if (input.kind === "novo") {
      payload = {
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.category,
        priority: computed.priority,
        affected,
        deadlineAt: deadlineFor(computed.priority, now).toISOString(),
        rule: computed.rule,
        assumptions: computed.assumptions,
        duplicateCheck: input.duplicateCheck,
        changes: input.changes ?? null,
      };
    } else {
      const number = input.targetTicket?.trim().toUpperCase();
      if (!number) return { error: "missing_target", message: "Informe targetTicket para atualização ou reabertura." };
      const lookup = await guardTickets(async () => ({
        ticket: await app.tickets.get(number, { requesterEmail: employee.email }),
      }));
      if ("error" in lookup) return lookup;
      const target = lookup.ticket;
      if (!target) return { error: "not_found", message: "Não encontrei esse chamado entre os do funcionário." };
      if (input.kind === "atualizacao" && target.status === "resolvido") {
        return { error: "ticket_resolved", message: "Esse chamado está resolvido: proponha reabertura (até 7 dias) ou chamado novo." };
      }
      if (input.kind === "reabertura") {
        if (target.status !== "resolvido") return { error: "ticket_open", message: "Esse chamado está aberto: proponha atualização." };
        if (!target.resolvedAt || !canReopen(target.resolvedAt, now)) {
          return { error: "outside_reopen_window", message: "Resolvido há mais de 7 dias: proponha chamado novo citando o número anterior na descrição." };
        }
      }
      const newPriority: Priority | null =
        input.kind === "atualizacao" && input.changesPriority && computed.priority !== target.priority ? computed.priority : null;
      payload = {
        title: target.title,
        description: input.note ?? input.description,
        type: target.kind,
        category: target.category,
        priority: target.priority,
        affected: target.affected,
        deadlineAt: deadlineFor(newPriority ?? target.priority, now).toISOString(),
        rule: newPriority ? computed.rule : `Mantém a prioridade ${target.priority} do chamado.`,
        assumptions: computed.assumptions,
        targetTicket: target.number,
        note: input.note ?? input.description,
        newPriority,
        duplicateCheck: input.duplicateCheck,
        changes: input.changes ?? null,
      };
      scratch.focusTicket = target.number;
      scratch.mentionedTickets.add(target.number);
      await relateTickets(app.db, conversation, [target.number], { focus: target.number, at: now.toISOString() });
    }

    const { draft, replaced } = await proposeDraft(app, conversation, { kind: input.kind, payload });
    scratch.draftId = draft.id;
    const effective = payload.newPriority ?? payload.priority;
    return {
      ok: true,
      draftId: draft.id,
      displayCode: draft.displayCode,
      kind: draft.kind,
      priority: effective,
      rule: payload.rule,
      assumptions: payload.assumptions,
      deadlineText: deadlineText(new Date(payload.deadlineAt), now),
      replaced: replaced !== null,
      replacedCode: replaced?.displayCode ?? null,
    };
  },
});
