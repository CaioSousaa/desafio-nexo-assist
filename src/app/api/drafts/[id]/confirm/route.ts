import { requireEmployee } from "@/server/auth/require";
import { confirmDraft } from "@/server/drafts/service";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request, context: RouteContext<"/api/drafts/[id]/confirm">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const { id } = await context.params;
    const result = await confirmDraft(ctx, id, employee);
    return ok({ draft: result.draft, ticket: result.ticket ?? null, message: result.message });
  });
}
