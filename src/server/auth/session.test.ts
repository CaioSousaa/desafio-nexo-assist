import { describe, expect, it } from "vitest";
import {
  authenticate,
  readSessionCookie,
  REMEMBER_MAX_AGE_S,
  sessionCookie,
  signSession,
  verifySession,
} from "./session";

const secret = "segredo-de-teste-com-tamanho";
const users = new Map([
  ["ana.souza@nexo.com.br", { id: "u-ana", role: "funcionario" as const }],
  ["rafael.lima@nexo.com.br", { id: "u-rafael", role: "analista" as const }],
]);
const find = async (email: string) => users.get(email) ?? null;

describe("authenticate", () => {
  it("aceita e-mail dos dados de exemplo com qualquer senha não vazia", async () => {
    expect(await authenticate(find, "ana.souza@nexo.com.br", "x")).toEqual({ ok: true, user: users.get("ana.souza@nexo.com.br") });
  });

  it("normaliza caixa e espaços do e-mail", async () => {
    expect((await authenticate(find, "  Ana.Souza@NEXO.com.br ", "123")).ok).toBe(true);
  });

  it("e-mail desconhecido → email_not_found", async () => {
    expect(await authenticate(find, "ninguem@nexo.com.br", "x")).toEqual({ ok: false, error: "email_not_found" });
  });

  it("senha vazia → invalid_input", async () => {
    expect(await authenticate(find, "ana.souza@nexo.com.br", "")).toEqual({ ok: false, error: "invalid_input" });
  });
});

describe("cookie de sessão HMAC", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("token válido preserva usuário e perfil", () => {
    const { token } = signSession({ id: "u-rafael", role: "analista" }, { secret, remember: false, now });
    expect(verifySession(token, { secret, now })).toMatchObject({ uid: "u-rafael", role: "analista" });
  });

  it("token expirado é inválido", () => {
    const { token, payload } = signSession({ id: "u-ana", role: "funcionario" }, { secret, remember: false, now });
    expect(verifySession(token, { secret, now: new Date(payload.exp * 1000) })).toBeNull();
    expect(verifySession(token, { secret, now: new Date(payload.exp * 1000 - 1000) })).not.toBeNull();
  });

  it("token adulterado (um byte) é inválido", () => {
    const { token } = signSession({ id: "u-ana", role: "funcionario" }, { secret, remember: false, now });
    const [body, sig] = token.split(".") as [string, string];
    const forgedBody = Buffer.from(JSON.stringify({ uid: "u-ana", role: "analista", exp: 9e9 })).toString("base64url");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifySession(`${body}.${flipped}`, { secret, now })).toBeNull();
    expect(verifySession(`${forgedBody}.${sig}`, { secret, now })).toBeNull();
    expect(verifySession(token, { secret: "outro-segredo-qualquer", now })).toBeNull();
    expect(verifySession("lixo", { secret, now })).toBeNull();
    expect(verifySession(undefined, { secret, now })).toBeNull();
  });

  it('"Manter conectado" → 30 dias; sem ele → cookie de sessão (sem Max-Age)', () => {
    const remember = signSession({ id: "u-ana", role: "funcionario" }, { secret, remember: true, now });
    expect(remember.maxAge).toBe(REMEMBER_MAX_AGE_S);
    expect(remember.payload.exp - now.getTime() / 1000).toBe(REMEMBER_MAX_AGE_S);
    expect(sessionCookie(remember)).toMatchObject({ maxAge: REMEMBER_MAX_AGE_S, httpOnly: true, sameSite: "lax", path: "/" });

    const browser = signSession({ id: "u-ana", role: "funcionario" }, { secret, remember: false, now });
    expect(browser.maxAge).toBeUndefined();
    expect(sessionCookie(browser)).not.toHaveProperty("maxAge");
  });

  it("lê o cookie no meio de outros", () => {
    expect(readSessionCookie("a=1; nexo_session=abc.def; b=2")).toBe("abc.def");
    expect(readSessionCookie("a=1")).toBeUndefined();
    expect(readSessionCookie(null)).toBeUndefined();
  });
});
