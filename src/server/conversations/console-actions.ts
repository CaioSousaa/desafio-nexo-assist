import { postAgentTemplate, templates } from "../agent/templates";
import type { User } from "../auth/users";
import type { AppContext } from "../context";
import { expirePendingDraft } from "../drafts/service";
import { HttpError } from "../http/respond";
import { logger } from "../logger";
import { insertMessage, type Message } from "../messages/repo";
import { findUserById } from "../auth/users";
import { findConversation, updateConversation, type Conversation } from "./repo";
import { notifyConsole, publishToConversation } from "./publish";
import { appendSystemEvent, publishState } from "./service";

async function mustFind(ctx: AppContext, id: string): Promise<Conversation> {
  const conversation = await findConversation(ctx.db, id);
  if (!conversation) throw new HttpError(404, "not_found", "Conversa não encontrada.");
  return conversation;
}

async function assignedName(ctx: AppContext, conversation: Conversation): Promise<string> {
  if (!conversation.assignedAnalystId) return "outro analista";
  return (await findUserById(ctx.db, conversation.assignedAnalystId))?.name ?? "outro analista";
}

/**
 * "Assumir atendimento" (FR-055, FR-060): vale para conversa aguardando atendente ou com o agent.
 * UPDATE condicional: entre dois analistas simultâneos, só o primeiro vence; o outro recebe 409.
 */
export async function takeConversation(ctx: AppContext, analyst: User, conversationId: string): Promise<Conversation> {
  const current = await mustFind(ctx, conversationId);
  if (current.state === "encerrada") throw new HttpError(409, "closed", "Esta conversa já foi encerrada.");
  const at = ctx.now().toISOString();
  const taken = await updateConversation(
    ctx.db,
    conversationId,
    { state: "com_analista", assignedAnalystId: analyst.id, pendingTransfer: false, updatedAt: at },
    { states: ["com_agent", "aguardando_atendente"], assignedAnalystId: null },
  );
  if (!taken) {
    const fresh = await mustFind(ctx, conversationId);
    if (fresh.state === "encerrada") throw new HttpError(409, "closed", "Esta conversa já foi encerrada.");
    const name = await assignedName(ctx, fresh);
    throw new HttpError(409, "already_assigned", `Em atendimento por ${name}`, { assignedTo: name });
  }
  await appendSystemEvent(ctx, taken, "assumida", { actor: analyst.name });
  if (taken.focusTicket) {
    try {
      await ctx.tickets.setStatus(taken.focusTicket, "em_atendimento", {
        text: `Assumido por ${analyst.name}`,
        author: analyst.name,
        eventKind: "assumido",
      });
    } catch (error) {
      logger.warn("take_ticket_note_failed", { conversationId, ticket: taken.focusTicket, error });
    }
  }
  publishState(ctx, taken, analyst.name);
  logger.info("conversation_taken", { conversationId, analystId: analyst.id });
  return taken;
}

/** "Devolver ao agent" (FR-057): de "aguardando atendente" ou da conversa assumida pelo próprio analista. */
export async function returnToAgent(ctx: AppContext, analyst: User, conversationId: string): Promise<Conversation> {
  await mustFind(ctx, conversationId);
  const at = ctx.now().toISOString();
  const patch = { state: "com_agent" as const, assignedAnalystId: null, pendingTransfer: false, updatedAt: at };
  const returned =
    (await updateConversation(ctx.db, conversationId, patch, { states: ["aguardando_atendente"], assignedAnalystId: null })) ??
    (await updateConversation(ctx.db, conversationId, patch, { states: ["com_analista"], assignedAnalystId: analyst.id }));
  if (!returned) throw new HttpError(409, "not_allowed", "Só dá para devolver conversa aguardando atendente ou assumida por você.");
  await appendSystemEvent(ctx, returned, "devolvida", { actor: analyst.name });
  await postAgentTemplate(ctx, returned, templates.resume(returned.focusTicket));
  publishState(ctx, returned);
  logger.info("conversation_returned", { conversationId, analystId: analyst.id });
  return returned;
}

/** "Encerrar atendimento" (FR-058): só o analista atribuído. A próxima mensagem do funcionário abre nova conversa. */
export async function closeByAnalyst(ctx: AppContext, analyst: User, conversationId: string): Promise<Conversation> {
  await mustFind(ctx, conversationId);
  const at = ctx.now().toISOString();
  const closed = await updateConversation(
    ctx.db,
    conversationId,
    { state: "encerrada", outcome: "encerrada_pelo_analista", closedAt: at, updatedAt: at, pendingTransfer: false },
    { states: ["com_analista"], assignedAnalystId: analyst.id },
  );
  if (!closed) throw new HttpError(409, "not_assigned_to_you", "Só o analista que assumiu pode encerrar.");
  await expirePendingDraft(ctx, closed);
  await appendSystemEvent(ctx, closed, "encerrada");
  if (closed.focusTicket) {
    try {
      await ctx.tickets.addNote(
        closed.focusTicket,
        { text: `Atendimento encerrado por ${analyst.name}`, author: analyst.name },
        { idempotencyKey: `close:${closed.id}` },
      );
    } catch (error) {
      logger.warn("close_ticket_note_failed", { conversationId, error });
    }
  }
  publishState(ctx, closed);
  logger.info("conversation_closed", { conversationId, outcome: "encerrada_pelo_analista" });
  return closed;
}

/** Mensagem do analista (FR-056): só quem assumiu; chega ao funcionário em tempo real com nome e nível. */
export async function sendAnalystMessage(
  ctx: AppContext,
  analyst: User,
  conversationId: string,
  input: { text: string; clientMessageId: string },
): Promise<Message> {
  const conversation = await mustFind(ctx, conversationId);
  if (conversation.state !== "com_analista" || conversation.assignedAnalystId !== analyst.id) {
    throw new HttpError(403, "not_assigned_to_you", "Assuma o atendimento para responder.");
  }
  const { message, duplicate } = await insertMessage(ctx.db, {
    conversationId,
    authorType: "analista",
    authorId: analyst.id,
    text: input.text,
    clientMessageId: input.clientMessageId,
    createdAt: ctx.now().toISOString(),
  });
  if (!duplicate) {
    publishToConversation(ctx, conversation, "message", {
      message,
      author: { name: analyst.name, level: analyst.analystLevel },
    });
    notifyConsole(ctx, conversationId);
  }
  return message;
}
