import { requireEmployee } from "@/server/auth/require";
import { channels } from "@/server/events/bus";
import { handle } from "@/server/http/respond";
import { sseResponse } from "@/server/http/sse";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

/** Eventos do chat do funcionário: canal por funcionário, cobre a troca para uma conversa nova. */
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    return sseResponse(ctx.bus, channels.employee(employee.id), {
      lastEventId: request.headers.get("last-event-id"),
      signal: request.signal,
    });
  });
}
