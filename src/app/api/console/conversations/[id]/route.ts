import { requireAnalyst } from "@/server/auth/require";
import { consoleSnapshot } from "@/server/conversations/snapshot";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/console/conversations/[id]">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const analyst = await requireAnalyst(ctx, request);
    const { id } = await context.params;
    return ok(await consoleSnapshot(ctx, analyst, id));
  });
}
