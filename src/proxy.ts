import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

/**
 * Redirecionamento otimista por perfil (FR-004). As rotas da API e as páginas validam de novo a sessão;
 * aqui só se evita mostrar a área errada.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value, { secret: process.env.SESSION_SECRET ?? "" });
  const home = session?.role === "analista" ? "/console" : "/chat";

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(home, request.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname === "/") return NextResponse.redirect(new URL(home, request.url));
  if (session.role === "funcionario" && pathname.startsWith("/console")) return NextResponse.redirect(new URL("/chat", request.url));
  if (session.role === "analista" && (pathname.startsWith("/chat") || pathname.startsWith("/perfil"))) {
    return NextResponse.redirect(new URL("/console", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/chat/:path*", "/perfil/:path*", "/console/:path*"],
};
