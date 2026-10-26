import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "../auth/users";
import { userFromCookie } from "../auth/require";
import { SESSION_COOKIE } from "../auth/session";
import type { AppContext } from "../context";
import { ensureStarted } from "../startup";

/** Para páginas do servidor: garante a subida, lê a sessão e redireciona conforme o perfil (FR-004). */
export async function pageUser(role: User["role"]): Promise<{ ctx: AppContext; user: User }> {
  const ctx = await ensureStarted();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = token ? await userFromCookie(ctx, `${SESSION_COOKIE}=${token}`) : null;
  if (!user) redirect("/login");
  if (user.role !== role) redirect(user.role === "analista" ? "/console" : "/chat");
  return { ctx, user };
}
