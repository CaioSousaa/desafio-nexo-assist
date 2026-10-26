import { NextResponse } from "next/server";
import { expiredSessionCookie } from "@/server/auth/session";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  const { name, value, ...options } = expiredSessionCookie();
  response.cookies.set(name, value, options);
  return response;
}
