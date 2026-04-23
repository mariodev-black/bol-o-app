import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

/**
 * Rotas que exigem sessão válida no cookie httpOnly `bolao_session`.
 * O token (JWT) só trafega no cookie — o cliente não armazena sessão em localStorage.
 */
export async function middleware(request: NextRequest) {
  const name = sessionCookieName();
  const token = request.cookies.get(name)?.value;

  const redirectToLogin = () => {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  };

  if (!token) {
    return redirectToLogin();
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    userId = null;
  }

  if (!userId) {
    const res = redirectToLogin();
    res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/boloes/:path*",
    "/tickets/:path*",
    "/perfil/:path*",
    "/palpites/:path*",
    "/meus-palpites/:path*",
    "/dashboard/:path*",
    "/deposito/:path*",
    "/saques/:path*",
    "/privacidade/:path*",
    "/indique",
    "/indique/:path*",
  ],
};
