import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "nexo_session";
export const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60;
/** Sem "Manter conectado": cookie de sessão do navegador, com validade máxima de 12 h no token. */
const BROWSER_SESSION_S = 12 * 60 * 60;

export type Role = "funcionario" | "analista";

export interface SessionPayload {
  uid: string;
  role: Role;
  /** Expiração em segundos desde a época. */
  exp: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type AuthResult<TUser> = { ok: true; user: TUser } | { ok: false; error: "invalid_input" | "email_not_found" };

export const EMAIL_NOT_FOUND_MESSAGE = "Não encontramos esse e-mail corporativo";

/** Login simulado: e-mail dos dados de exemplo + qualquer senha não vazia (FR-001, FR-002). */
export async function authenticate<TUser>(
  findByEmail: (email: string) => Promise<TUser | null>,
  email: string,
  password: string,
): Promise<AuthResult<TUser>> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || password.length === 0) return { ok: false, error: "invalid_input" };
  const user = await findByEmail(normalized);
  if (!user) return { ok: false, error: "email_not_found" };
  return { ok: true, user };
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export interface SignedSession {
  token: string;
  payload: SessionPayload;
  /** Max-Age do cookie em segundos; undefined = cookie de sessão do navegador. */
  maxAge: number | undefined;
}

export function signSession(
  user: { id: string; role: Role },
  options: { secret: string; remember: boolean; now?: Date },
): SignedSession {
  const nowS = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const lifetime = options.remember ? REMEMBER_MAX_AGE_S : BROWSER_SESSION_S;
  const payload: SessionPayload = { uid: user.id, role: user.role, exp: nowS + lifetime };
  const body = b64(JSON.stringify(payload));
  return {
    token: `${body}.${sign(body, options.secret)}`,
    payload,
    maxAge: options.remember ? REMEMBER_MAX_AGE_S : undefined,
  };
}

/** Valida assinatura (tempo constante) e expiração; qualquer problema devolve null. */
export function verifySession(
  token: string | undefined | null,
  options: { secret: string; now?: Date },
): SessionPayload | null {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, options.secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.role !== "funcionario" && payload.role !== "analista") return null;
    const nowS = Math.floor((options.now ?? new Date()).getTime() / 1000);
    if (payload.exp <= nowS) return null;
    return { uid: payload.uid, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export interface CookieSpec {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge?: number;
}

export function sessionCookie(session: SignedSession, secure = process.env.NODE_ENV === "production"): CookieSpec {
  return {
    name: SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    ...(session.maxAge !== undefined ? { maxAge: session.maxAge } : {}),
  };
}

export function expiredSessionCookie(): CookieSpec {
  return { name: SESSION_COOKIE, value: "", httpOnly: true, sameSite: "lax", path: "/", secure: false, maxAge: 0 };
}

/** Lê o valor do cookie de sessão de um cabeçalho Cookie. */
export function readSessionCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}
