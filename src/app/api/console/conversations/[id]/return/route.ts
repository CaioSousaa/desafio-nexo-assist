import { requireAnalyst } from "@/server/auth/require";
import { returnToAgent } from "@/server/conversations/console-actions";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request, context: RouteContext<"/api/console/conversations/[id]/return">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const analyst = await requireAnalyst(ctx, request);
    const { id } = await context.params;
    const conversation = await returnToAgent(ctx, analyst, id);
    return ok({ conversation: { id: conversation.id, state: conversation.state, assignedAnalystId: conversation.assignedAnalystId } });
  });
}
