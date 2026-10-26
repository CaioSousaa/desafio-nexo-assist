import { requireEmployee } from "@/server/auth/require";
import { cancelDraft } from "@/server/drafts/service";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request, context: RouteContext<"/api/drafts/[id]/cancel">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const { id } = await context.params;
    const result = await cancelDraft(ctx, id, employee);
    return ok({ draft: result.draft, message: result.message });
  });
}
