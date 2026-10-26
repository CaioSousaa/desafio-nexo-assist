import type { AppContext } from "../context";
import { channels, type BusEventType } from "../events/bus";

/** Publica um evento da conversa para o console (canal da conversa) e para o chat do funcionário. */
export function publishToConversation(
  ctx: Pick<AppContext, "bus">,
  conversation: { id: string; employeeId: string },
  type: BusEventType,
  data: Record<string, unknown>,
): void {
  const payload = { conversationId: conversation.id, ...data };
  ctx.bus.publish(channels.conversation(conversation.id), type, payload);
  ctx.bus.publish(channels.employee(conversation.employeeId), type, payload);
}

/** Avisa o console que a lista mudou (nova mensagem, mudança de estado). */
export function notifyConsole(ctx: Pick<AppContext, "bus">, conversationId: string): void {
  ctx.bus.publish(channels.console, "conversation_updated", { conversationId });
}
