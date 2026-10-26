import { randomUUID } from "node:crypto";
import { postAgentTemplate } from "@/server/agent/templates";
import type { AppContext } from "@/server/context";
import { incrementAgentMessageCount, type Conversation } from "@/server/conversations/repo";
import type { DraftPayload } from "@/server/drafts/repo";
import { proposeDraft } from "@/server/drafts/service";
import { insertMessage } from "@/server/messages/repo";
import { deadlineFor } from "@/server/rules/sla";
import type { Ticket } from "@/server/tickets";
import type { TicketEventKind } from "@/server/tickets/types";

const DAY = 86_400_000;

/** Chamado extra do funcionário (datas relativas a agora). */
export async function addTicket(
  ctx: AppContext,
  ticket: Omit<Ticket, "createdAt" | "updatedAt" | "resolvedAt"> & { createdDaysAgo: number; updatedDaysAgo?: number; resolvedDaysAgo?: number },
): Promise<void> {
  const now = ctx.now().getTime();
  const { createdDaysAgo, updatedDaysAgo, resolvedDaysAgo, ...rest } = ticket;
  const iso = (days: number) => new Date(now - days * DAY).toISOString();
  await ctx.ticketsLocal.seed([
    {
      ticket: {
        ...rest,
        createdAt: iso(createdDaysAgo),
        updatedAt: iso(updatedDaysAgo ?? resolvedDaysAgo ?? createdDaysAgo),
        resolvedAt: resolvedDaysAgo === undefined ? null : iso(resolvedDaysAgo),
      },
      events: [{ kind: "criado" as TicketEventKind, text: "Chamado aberto pelo formulário.", author: "funcionário", createdAt: iso(createdDaysAgo) }],
    },
  ]);
}

export async function resolveTickets(ctx: AppContext, numbers: string[]): Promise<void> {
  for (const number of numbers) await ctx.tickets.setStatus(number, "resolvido", { text: "Resolvido.", author: "Rafael Lima" });
}

/** Histórico realista até um rascunho pendente (para cenários de edição e de "obrigado" no meio do fluxo). */
export async function conversationWithDraft(ctx: AppContext, conversation: Conversation, payload: Partial<DraftPayload> = {}): Promise<void> {
  const at = () => ctx.now().toISOString();
  const say = async (text: string) => {
    await insertMessage(ctx.db, { conversationId: conversation.id, authorType: "funcionario", authorId: conversation.employeeId, text, clientMessageId: randomUUID(), countsTowardLimit: true, createdAt: at() });
    await incrementAgentMessageCount(ctx.db, conversation.id, at());
  };
  await say("Meu notebook não conecta na VPN desde ontem. Erro 809.");
  await postAgentTemplate(ctx, conversation, {
    text: "Não há chamado aberto sobre VPN, e o artigo do erro 809 vale só para Windows 10 — o seu é Windows 11. Vou abrir um chamado. Quem está sendo afetado?",
    parts: { quick_options: ["Só eu", "Minha equipe", "Toda a empresa", "Não sei"] },
    action: "pedir_esclarecimento",
    intent: "VPN com erro 809",
    rationale: "Falta saber quem é afetado.",
    rules: [],
    steps: [{ tool: "list_my_tickets", labels: ["consultou seus chamados"] }, { tool: "search_help_center", labels: ["buscou na central de ajuda"] }],
  });
  await say("Só eu. Tenho reunião com cliente às 14h.");
  const full: DraftPayload = {
    title: "VPN não conecta no notebook — erro 809",
    description: "Desde ontem o notebook (Windows 11) não conecta na VPN e mostra o erro 809. Precisa dela para a reunião com cliente às 14h.",
    type: "INC",
    category: "Rede e VPN",
    priority: "Alta",
    affected: "somente_voce",
    deadlineAt: deadlineFor("Alta", ctx.now()).toISOString(),
    rule: "Afeta só você, com compromisso no mesmo dia: prioridade Alta (4 horas úteis).",
    assumptions: [],
    duplicateCheck: { considered: ["INC-20311", "INC-20298", "REQ-10442"], verdict: "diferente", why: "Nenhum é sobre VPN." },
    ...payload,
  };
  const { draft } = await proposeDraft(ctx, conversation, { kind: "novo", payload: full });
  await postAgentTemplate(ctx, conversation, {
    text: "Coloquei prioridade Alta por causa da reunião — a resposta chega antes das 14h. Confira antes de eu criar:",
    parts: { draft_id: draft.id },
    action: "propor_chamado",
    intent: "Abrir chamado da VPN",
    rationale: "Compromisso no mesmo dia.",
    rules: [],
    steps: [{ tool: "propose_draft", labels: ["montou o rascunho"] }],
  });
}
