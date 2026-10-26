import { requireEmployee } from "@/server/auth/require";
import { chatSnapshot } from "@/server/conversations/snapshot";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    return ok(await chatSnapshot(ctx, employee));
  });
}
