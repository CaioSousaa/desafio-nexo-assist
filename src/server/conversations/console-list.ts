import { formatTime, relativeTime } from "@/lib/format";
import { listUsers, type User } from "../auth/users";
import type { AppContext } from "../context";
import { conversationReads } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ConsoleFilter } from "../http/schemas";
import { normalize } from "../help-center/search";
import { listMessagesFor, type Message } from "../messages/repo";
import { listAllConversations, type Conversation } from "./repo";
import { contactTargetAt } from "./transfer";

export type LabelTone = "warning" | "violet" | "neutral" | "primary" | "success" | "muted";

export interface ConsoleListItem {
  id: string;
  employee: { id: string; name: string; department: string | null };
  state: Conversation["state"];
  preview: string;
  lastAt: string;
  label: string;
  tone: LabelTone;
  relatedTicket: string | null;
  confidence: number | null;
  unread: number;
  waitingSince: string | null;
  late: boolean;
  assignedAnalyst: { id: string; name: string } | null;
}

export interface ConsoleList {
  items: ConsoleListItem[];
  counts: Record<ConsoleFilter, number>;
}

/** Rótulo de estado do console (FR-050), com chamado relacionado ou confiança quando aplicável. */
export function consoleLabel(
  conversation: Conversation,
  context: { analystId: string; analystName: string | null; now: Date },
): { label: string; tone: LabelTone } {
  switch (conversation.state) {
    case "aguardando_atendente": {
      if (conversation.transferReason === "baixa_confianca") {
        return { label: `Agent pediu ajuda · confiança ${conversation.transferConfidence ?? 0}%`, tone: "violet" };
      }
      if (conversation.focusTicket) return { label: `Transferida · ${conversation.focusTicket}`, tone: "warning" };
      const target = conversation.transferredAt ? contactTargetAt(new Date(conversation.transferredAt)) : null;
      if (target && context.now > target) return { label: "Transferida · atrasada", tone: "warning" };
      return { label: target ? `Transferida · contato ${relativeTime(target, context.now)}` : "Transferida", tone: "warning" };
    }
    case "com_agent":
      return { label: "Agent atendendo", tone: "neutral" };
    case "com_analista":
      return conversation.assignedAnalystId === context.analystId
        ? { label: "Você está atendendo", tone: "primary" }
        : { label: `Em atendimento por ${context.analystName ?? "outro analista"}`, tone: "muted" };
    case "encerrada":
      if (conversation.outcome === "resolvida_pelo_agent") return { label: "Resolvida pelo agent", tone: "success" };
      if (conversation.outcome === "limite_atingido") return { label: "Encerrada · limite de mensagens", tone: "muted" };
      return { label: "Encerrada", tone: "muted" };
  }
}

function preview(message: Message | undefined, analystId: string, users: Map<string, User>): string {
  if (!message) return "";
  const text = message.text.replace(/\s+/g, " ").trim();
  switch (message.authorType) {
    case "agent":
      return `Nexo: ${text}`;
    case "analista":
      return message.authorId === analystId ? `Você: ${text}` : `${users.get(message.authorId ?? "")?.name.split(" ")[0] ?? "Analista"}: ${text}`;
    default:
      return text;
  }
}

export function matchesFilter(item: Pick<ConsoleListItem, "state" | "assignedAnalyst">, filter: ConsoleFilter, analystId: string): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "para_voce":
      return item.state === "aguardando_atendente";
    case "com_agent":
      return item.state === "com_agent";
    case "minhas":
      return item.state === "com_analista" && item.assignedAnalyst?.id === analystId;
  }
}

/** Lista do console com filtros, busca, contagens, não lidas e "atrasada" (FR-050–FR-052, FR-103). */
export async function listForConsole(
  ctx: AppContext,
  analystId: string,
  options: { filter: ConsoleFilter; q?: string | undefined },
): Promise<ConsoleList> {
  const now = ctx.now();
  const users = new Map((await listUsers(ctx.db)).map((u) => [u.id, u]));
  const conversations = await listAllConversations(ctx.db);
  const messagesByConversation = await listMessagesFor(ctx.db, conversations.map((c) => c.id));
  const reads = new Map(
    (await ctx.db.select().from(conversationReads).where(eq(conversationReads.analystId, analystId))).map((r) => [r.conversationId, r.lastReadAt]),
  );

  const all: ConsoleListItem[] = [];
  for (const conversation of conversations) {
    const messages = (messagesByConversation.get(conversation.id) ?? []).filter((m) => m.status !== "pending" || m.text);
    if (messages.length === 0) continue;
    const employee = users.get(conversation.employeeId);
    const analyst = conversation.assignedAnalystId ? users.get(conversation.assignedAnalystId) : undefined;
    const last = [...messages].reverse().find((m) => m.text.trim());
    const readAt = reads.get(conversation.id);
    const target = conversation.transferredAt ? contactTargetAt(new Date(conversation.transferredAt)) : null;
    const { label, tone } = consoleLabel(conversation, { analystId, analystName: analyst?.name ?? null, now });
    all.push({
      id: conversation.id,
      employee: { id: conversation.employeeId, name: employee?.name ?? "Funcionário", department: employee?.department ?? null },
      state: conversation.state,
      preview: preview(last, analystId, users),
      lastAt: last?.createdAt ?? conversation.updatedAt,
      label,
      tone,
      relatedTicket: conversation.focusTicket,
      confidence: conversation.transferReason === "baixa_confianca" ? conversation.transferConfidence : null,
      unread: messages.filter((m) => m.authorType === "funcionario" && (!readAt || m.createdAt > readAt)).length,
      waitingSince: conversation.state === "aguardando_atendente" ? conversation.transferredAt : null,
      late: conversation.state === "aguardando_atendente" && target !== null && now > target,
      assignedAnalyst: analyst ? { id: analyst.id, name: analyst.name } : null,
    });
  }

  const counts: Record<ConsoleFilter, number> = {
    todas: all.length,
    para_voce: all.filter((i) => matchesFilter(i, "para_voce", analystId)).length,
    com_agent: all.filter((i) => matchesFilter(i, "com_agent", analystId)).length,
    minhas: all.filter((i) => matchesFilter(i, "minhas", analystId)).length,
  };

  const query = options.q ? normalize(options.q) : "";
  const tickets = new Map(conversations.map((c) => [c.id, [...c.relatedTickets, ...(c.transferSummary?.tickets ?? [])].map((t) => t.toLowerCase())]));
  let items = all.filter((item) => matchesFilter(item, options.filter, analystId));
  if (query) {
    items = items.filter(
      (item) => normalize(item.employee.name).includes(query) || (tickets.get(item.id) ?? []).some((t) => normalize(t).includes(query)),
    );
  }
  items.sort((a, b) =>
    options.filter === "para_voce"
      ? (a.waitingSince ?? "").localeCompare(b.waitingSince ?? "")
      : b.lastAt.localeCompare(a.lastAt),
  );
  return { items, counts };
}

/** "Agent pausado · até 12:05": horário-alvo de contato exibido na barra de assunção. */
export function contactTargetText(transferredAt: string | null): string | null {
  return transferredAt ? formatTime(contactTargetAt(new Date(transferredAt))) : null;
}
