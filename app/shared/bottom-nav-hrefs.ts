import { resolveProductHref } from "@/lib/site-hosts-client";

export type BottomNavHostContext = {
  isLoggedIn: boolean;
  onApp: boolean;
  onMarketing: boolean;
  subdomainRoutingEnabled: boolean;
  appOrigin: string;
  marketingOrigin: string;
};

const APP_PRODUCT_PREFIXES = [
  "/boloes",
  "/ranking",
  "/premiacao",
  "/indique",
  "/tickets",
  "/cadastrar",
  "/meus-palpites",
  "/perfil",
  "/login",
] as const;

function isAppProductPath(pathname: string): boolean {
  return APP_PRODUCT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Home do app logado: `/` (LoggedInHome — carrossel, próximos jogos).
 * Visitante no www: LP em `/`. Visitante no app: site de vendas.
 */
export function resolveBottomNavHomeHref(ctx: BottomNavHostContext): string {
  if (ctx.isLoggedIn) {
    if (ctx.subdomainRoutingEnabled && ctx.onMarketing) {
      return resolveProductHref("/", ctx.appOrigin, true);
    }
    return "/";
  }
  if (ctx.subdomainRoutingEnabled && ctx.onApp) {
    return ctx.marketingOrigin.replace(/\/+$/, "");
  }
  return "/";
}

/** Resolve href do bottom nav / menu lateral (home + rotas de produto no www). */
export function resolveBottomNavHref(href: string, ctx: BottomNavHostContext): string {
  const raw = href.trim();
  if (raw === "/" || raw === "") {
    return resolveBottomNavHomeHref(ctx);
  }

  const pathname = raw.split("?")[0] ?? raw;
  if (ctx.subdomainRoutingEnabled && ctx.onMarketing && isAppProductPath(pathname)) {
    return resolveProductHref(raw, ctx.appOrigin, true);
  }

  return raw;
}

export function isBottomNavHomeActive(
  href: string,
  pathname: string,
  ctx: BottomNavHostContext,
  currentOrigin?: string,
): boolean {
  const homeHref = resolveBottomNavHomeHref(ctx);
  if (href !== homeHref) return false;

  if (ctx.isLoggedIn) {
    return pathname === "/" || pathname === "";
  }

  if (homeHref.startsWith("http")) {
    try {
      const homeUrl = new URL(homeHref);
      if (currentOrigin && homeUrl.origin !== currentOrigin) return false;
      return pathname === homeUrl.pathname || pathname === "/";
    } catch {
      return pathname === "/";
    }
  }

  return pathname === "/" || pathname === "";
}
