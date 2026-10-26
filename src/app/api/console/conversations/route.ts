import { requireAnalyst } from "@/server/auth/require";
import { listForConsole } from "@/server/conversations/console-list";
import { handle, ok } from "@/server/http/respond";
import { consoleListQuery } from "@/server/http/schemas";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const analyst = await requireAnalyst(ctx, request);
    const params = new URL(request.url).searchParams;
    const query = consoleListQuery.parse({ filter: params.get("filter") ?? undefined, q: params.get("q") ?? undefined });
    return ok(await listForConsole(ctx, analyst.id, query));
  });
}
