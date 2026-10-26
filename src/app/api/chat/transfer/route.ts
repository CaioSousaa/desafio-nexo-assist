import { requireEmployee } from "@/server/auth/require";
import { transferAtLimit } from "@/server/conversations/limit";
import { handle, ok } from "@/server/http/respond";
import { ensureStarted } from "@/server/startup";

// Pode chamar o modelo para resumir a conversa.
export const maxDuration = 120;

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const conversation = await transferAtLimit(ctx, employee.id);
    return ok({ conversation: { id: conversation.id, state: conversation.state } });
  });
}
