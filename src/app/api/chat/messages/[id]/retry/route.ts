import { after } from "next/server";
import { retryAgentMessage } from "@/server/agent/run-turn";
import { requireEmployee } from "@/server/auth/require";
import { handle, ok } from "@/server/http/respond";
import { logger } from "@/server/logger";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request, context: RouteContext<"/api/chat/messages/[id]/retry">) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const { id } = await context.params;
    const retry = await retryAgentMessage(ctx, employee, id);
    after(() => retry.run().catch((error: unknown) => logger.error("turn_unhandled", { error })));
    return ok({ messageId: retry.message.id }, 202);
  });
}
