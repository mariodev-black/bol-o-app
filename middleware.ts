import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canonicalHostname } from "@/lib/auth/request-host";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import {
  hasSkaleLockedCookie,
  isSkaleFunnelAllowedPath,
  markSkaleFunnelEntry,
  shouldMarkSkaleFunnelFromRequest,
} from "@/lib/boloes/skale-funnel-shared";
import { getSignInPathForHost, resolveHostRouting } from "@/lib/site-hosts";

const PROTECTED_PREFIXES = [
  "/boloes",
  "/admin",
  "/tickets",
  "/perfil",
  "/ranking",
  "/palpites",
  "/meus-palpites",
  "/dashboard",
  "/deposito",
  "/saques",
  "/privacidade",
  "/indique",
  "/premiacao",
  "/promocoes",
  "/skale",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withSkaleFunnelCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (shouldMarkSkaleFunnelFromRequest(request)) {
    markSkaleFunnelEntry(response);
  }
  return response;
}

/**
 * Rotas que exigem sessão válida no cookie httpOnly `bolao_session`.
 */
export async function middleware(request: NextRequest) {
  const hostRedirect = await resolveHostRouting(request);
  if (hostRedirect) return hostRedirect;

  const pathname = request.nextUrl.pathname;

  if (
    hasSkaleLockedCookie(request) &&
    !isSkaleFunnelAllowedPath(pathname)
  ) {
    return withSkaleFunnelCookie(
      request,
      NextResponse.redirect(new URL("/skale", request.url)),
    );
  }

  if (!isProtectedPath(pathname)) {
    return withSkaleFunnelCookie(request, NextResponse.next());
  }

  const name = sessionCookieName();
  const token = request.cookies.get(name)?.value;
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isAdminLogin = request.nextUrl.pathname === "/admin/login";
  const hostname = canonicalHostname(request);

  const redirectToSignIn = () => {
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const signInPath = getSignInPathForHost(hostname);
    const signIn = new URL(signInPath, request.url);
    signIn.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  };

  if (isAdminLogin) {
    return withSkaleFunnelCookie(request, NextResponse.next());
  }

  if (!token) {
    return withSkaleFunnelCookie(request, redirectToSignIn());
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    userId = null;
  }

  if (!userId) {
    const res = redirectToSignIn();
    res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
    return withSkaleFunnelCookie(request, res);
  }

  return withSkaleFunnelCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
