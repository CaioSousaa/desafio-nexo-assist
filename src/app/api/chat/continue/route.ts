import { requireEmployee } from "@/server/auth/require";
import { continueInNewConversation } from "@/server/conversations/limit";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const conversation = await continueInNewConversation(ctx, employee.id);
    return ok({ conversationId: conversation.id });
  });
}
