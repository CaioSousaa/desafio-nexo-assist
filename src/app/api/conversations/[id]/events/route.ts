import { requireSession } from "@/server/auth/require";
import { findConversation } from "@/server/conversations/repo";
import { channels } from "@/server/events/bus";
import { handle, HttpError } from "@/server/http/respond";
import { sseResponse } from "@/server/http/sse";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

/** Eventos de uma conversa: o analista vê qualquer uma; o funcionário só a própria. */
export async function GET(request: Request, context: RouteContext<"/api/conversations/[id]/events">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const user = await requireSession(ctx, request);
    const { id } = await context.params;
    const conversation = await findConversation(ctx.db, id);
    if (!conversation) throw new HttpError(404, "not_found", "Conversa não encontrada.");
    if (user.role !== "analista" && conversation.employeeId !== user.id) throw new HttpError(403, "forbidden", "Sem acesso a esta conversa.");
    return sseResponse(ctx.bus, channels.conversation(id), { lastEventId: request.headers.get("last-event-id"), signal: request.signal });
  });
}
