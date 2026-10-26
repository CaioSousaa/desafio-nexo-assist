import { requireSession } from "@/server/auth/require";
import { publicUser } from "@/server/auth/users";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    return ok({ user: publicUser(await requireSession(ctx, request)) });
  });
}
