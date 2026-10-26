import { after } from "next/server";
import { acceptEmployeeMessage } from "@/server/agent/run-turn";
import { requireEmployee } from "@/server/auth/require";
import { handle, ok, readJson } from "@/server/http/respond";
import { messageInput } from "@/server/http/schemas";
import { logger } from "@/server/logger";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const input = messageInput.parse(await readJson(request));
    const accepted = await acceptEmployeeMessage(ctx, employee, input);
    if (accepted.run) {
      // O turno roda depois da resposta; passos e texto chegam pelo SSE.
      const run = accepted.run;
      after(() => run().catch((error: unknown) => logger.error("turn_unhandled", { error })));
    }
    return ok(
      {
        messageId: accepted.employeeMessage.id,
        conversationId: accepted.conversation.id,
        agentMessageId: accepted.agentMessage?.id ?? null,
        duplicate: accepted.duplicate,
      },
      202,
    );
  });
}
