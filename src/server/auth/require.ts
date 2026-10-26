import { getEnv } from "@/env";
import type { AppContext } from "../context";
import { HttpError } from "../http/respond";
import { readSessionCookie, verifySession } from "./session";
import { findUserById, type User } from "./users";

/** Usuário da sessão a partir do cabeçalho Cookie; 401 sem sessão válida. */
export async function userFromCookie(ctx: AppContext, cookieHeader: string | null | undefined): Promise<User | null> {
  const payload = verifySession(readSessionCookie(cookieHeader), { secret: getEnv().SESSION_SECRET, now: new Date() });
  if (!payload) return null;
  const user = await findUserById(ctx.db, payload.uid);
  return user && user.role === payload.role ? user : null;
}

export async function requireSession(ctx: AppContext, request: Request): Promise<User> {
  const user = await userFromCookie(ctx, request.headers.get("cookie"));
  if (!user) throw new HttpError(401, "unauthenticated", "Entre de novo para continuar.");
  return user;
}

export async function requireEmployee(ctx: AppContext, request: Request): Promise<User> {
  const user = await requireSession(ctx, request);
  if (user.role !== "funcionario") throw new HttpError(403, "forbidden", "Área exclusiva de funcionários.");
  return user;
}

export async function requireAnalyst(ctx: AppContext, request: Request): Promise<User> {
  const user = await requireSession(ctx, request);
  if (user.role !== "analista") throw new HttpError(403, "forbidden", "Área exclusiva do service desk.");
  return user;
}
