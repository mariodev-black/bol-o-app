import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canonicalHostname } from "@/lib/auth/request-host";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { isAppHostname, isMarketingHostname } from "@/lib/site-domain";
import { getAppOrigin, getMarketingOrigin } from "@/lib/seo/config";

export { isAppHostname, isMarketingHostname } from "@/lib/site-domain";

/** Ativa roteamento vendas (ápex + www) vs app (app.*). */
export function isSubdomainRoutingEnabled(): boolean {
  return process.env.SUBDOMAIN_ROUTING_ENABLED === "true";
}

/** Em dev: `localhost` / `127.0.0.1` contam como host do app (sem LP). */
export function isLocalDevAsApp(): boolean {
  return process.env.LOCAL_DEV_AS_APP === "true";
}

/** Rotas que existem só no host de app (não na LP de vendas). */
function isAppProductPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next")) return false;
  return true;
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return false;
  try {
    const userId = await verifySessionToken(token);
    return Boolean(userId);
  } catch {
    return false;
  }
}

/**
 * Redireciona conforme host:
 * - `app.{domínio}` → produto (`/` → cadastro ou bolões)
 * - `{domínio}` / `www.{domínio}` → LP; rotas de produto vão para `APP_URL`
 */
export async function resolveHostRouting(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!isSubdomainRoutingEnabled()) return null;

  const hostname = canonicalHostname(request);
  if (!hostname) return null;

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return null;
  }

  const onApp = isAppHostname(hostname);
  const onMarketing = isMarketingHostname(hostname);

  if (!onApp && !onMarketing) return null;

  if (onApp) {
    if (pathname !== "/") return null;

    const loggedIn = await hasValidSession(request);
    const target = loggedIn ? "/boloes" : "/cadastrar";
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  if (onMarketing && isAppProductPath(pathname)) {
    const appOrigin = getAppOrigin();
    const dest = new URL(
      `${pathname}${request.nextUrl.search}`,
      appOrigin.endsWith("/") ? appOrigin : `${appOrigin}/`,
    );
    return NextResponse.redirect(dest);
  }

  return null;
}

export function getSignInPathForHost(hostname: string): "/login" | "/cadastrar" {
  return isAppHostname(hostname) ? "/cadastrar" : "/login";
}

export { getAppOrigin, getMarketingOrigin };
