import { NextResponse } from "next/server";
import { getEnv } from "@/env";
import { authenticate, EMAIL_NOT_FOUND_MESSAGE, sessionCookie, signSession } from "@/server/auth/session";
import { findUserByEmail, publicUser } from "@/server/auth/users";
import { fail, handle, readJson } from "@/server/http/respond";
import { loginInput } from "@/server/http/schemas";
import { clientIp, limits } from "@/server/http/rate-limit";
import { ensureStarted } from "@/server/startup";

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await ensureStarted();
    const rate = limits().requests.hit(`login:${clientIp(request)}`, getEnv().RATE_LIMIT_LOGINS_PER_IP, 60_000);
    if (!rate.ok) return fail("rate_limited", `Muitas tentativas de login. Tente de novo em ${rate.retryAfterS} s.`, 429);
    const input = loginInput.parse(await readJson(request));
    const result = await authenticate((email) => findUserByEmail(ctx.db, email), input.email, input.password);
    if (!result.ok) {
      return result.error === "email_not_found"
        ? fail("email_not_found", EMAIL_NOT_FOUND_MESSAGE, 401)
        : fail("invalid_input", "Informe e-mail e senha.", 400);
    }
    const session = signSession(result.user, { secret: getEnv().SESSION_SECRET, remember: input.remember });
    const response = NextResponse.json({ user: publicUser(result.user) });
    const { name, value, ...options } = sessionCookie(session);
    response.cookies.set(name, value, options);
    return response;
  });
}
