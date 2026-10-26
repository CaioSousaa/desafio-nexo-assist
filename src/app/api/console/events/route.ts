import { requireAnalyst } from "@/server/auth/require";
import { channels } from "@/server/events/bus";
import { handle } from "@/server/http/respond";
import { sseResponse } from "@/server/http/sse";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    await requireAnalyst(ctx, request);
    return sseResponse(ctx.bus, channels.console, { lastEventId: request.headers.get("last-event-id"), signal: request.signal });
  });
}
