import { after } from "next/server";
import { acceptEmployeeMessage } from "@/server/agent/run-turn";
import { requireEmployee } from "@/server/auth/require";
import { getEnv } from "@/env";
import { fail, handle, ok, readJson } from "@/server/http/respond";
import { clientIp, limits } from "@/server/http/rate-limit";
import { messageInput } from "@/server/http/schemas";
import { logger } from "@/server/logger";
import { ensureStarted } from "@/server/startup";

// O turno roda depois da resposta (after) e pode levar mais de um minuto com o modelo lento.
export const maxDuration = 300;

/** Limite de uso por IP e teto diário de turnos (proteções do deploy público). */
function guardUsage(request: Request): Response | null {
  const env = getEnv();
  const rate = limits().requests.hit(`turn:${clientIp(request)}`, env.RATE_LIMIT_MESSAGES_PER_IP, 10 * 60_000);
  if (!rate.ok) return fail("rate_limited", `Você mandou muitas mensagens em pouco tempo. Tente de novo em ${Math.ceil(rate.retryAfterS / 60)} min.`, 429);
  if (!limits().turns.take(env.DAILY_TURN_LIMIT)) return fail("daily_limit", "O assistente atingiu o limite de uso de hoje nesta demonstração. Tente amanhã.", 429);
  return null;
}

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const employee = await requireEmployee(ctx, request);
    const input = messageInput.parse(await readJson(request));
    const blocked = guardUsage(request);
    if (blocked) return blocked;
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
