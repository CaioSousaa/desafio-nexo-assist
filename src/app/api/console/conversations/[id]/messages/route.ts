import { requireAnalyst } from "@/server/auth/require";
import { sendAnalystMessage } from "@/server/conversations/console-actions";
import { handle, ok, readJson } from "@/server/http/respond";
import { messageInput } from "@/server/http/schemas";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request, context: RouteContext<"/api/console/conversations/[id]/messages">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const analyst = await requireAnalyst(ctx, request);
    const { id } = await context.params;
    const input = messageInput.parse(await readJson(request));
    return ok({ message: await sendAnalystMessage(ctx, analyst, id, input) }, 201);
  });
}
