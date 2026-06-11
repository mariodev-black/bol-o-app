import type { NextRequest, NextResponse } from "next/server";

/** Usuário entrou pelo checkout Skale e ainda não comprou cota. */
export const SKALE_FUNNEL_COOKIE = "bolao_skale_funnel";

/** Cache no edge/middleware — definido pelo servidor após checar tickets. */
export const SKALE_LOCKED_COOKIE = "bolao_skale_locked";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function funnelCookieBase() {
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
    sameSite: "lax" as const,
  };
}

/** Rotas permitidas enquanto o funil Skale estiver ativo (sem cota paga). */
export function isSkaleFunnelAllowedPath(pathname: string): boolean {
  if (pathname === "/skale" || pathname.startsWith("/skale/")) return true;
  if (pathname === "/cadastrar" || pathname.startsWith("/cadastrar/")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/recuperar-senha" || pathname.startsWith("/recuperar-senha/")) {
    return true;
  }
  if (pathname === "/tickets/obrigado" || pathname.startsWith("/tickets/obrigado")) {
    return true;
  }
  if (pathname.startsWith("/api/")) return true;
  return false;
}

export function shouldMarkSkaleFunnelFromPath(
  pathname: string,
  fromParam: string | null,
): boolean {
  if (pathname === "/skale" || pathname.startsWith("/skale/")) return true;
  if (pathname === "/cadastrar" || pathname === "/login") {
    return fromParam === "/skale";
  }
  return false;
}

export function shouldMarkSkaleFunnelFromRequest(request: NextRequest): boolean {
  return shouldMarkSkaleFunnelFromPath(
    request.nextUrl.pathname,
    request.nextUrl.searchParams.get("from"),
  );
}

export function hasSkaleFunnelCookie(request: NextRequest): boolean {
  return request.cookies.get(SKALE_FUNNEL_COOKIE)?.value === "1";
}

export function hasSkaleLockedCookie(request: NextRequest): boolean {
  return request.cookies.get(SKALE_LOCKED_COOKIE)?.value === "1";
}

export function markSkaleFunnelEntry(res: NextResponse): void {
  res.cookies.set(SKALE_FUNNEL_COOKIE, "1", funnelCookieBase());
}

export function markSkaleFunnelLocked(res: NextResponse): void {
  res.cookies.set(SKALE_LOCKED_COOKIE, "1", funnelCookieBase());
}

export function clearSkaleFunnelCookies(res: NextResponse): void {
  for (const name of [SKALE_FUNNEL_COOKIE, SKALE_LOCKED_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
}
