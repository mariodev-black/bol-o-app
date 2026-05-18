"use client";

import { isAppHostname, isMarketingHostname } from "@/lib/site-domain";

/** Espelha `isAppHostname` no cliente. */
export function isAppHostClient(): boolean {
  if (typeof window === "undefined") return false;
  return isAppHostname(window.location.hostname);
}

/** Host da LP: ápex + www do domínio (+ www.localhost em dev). */
export function isMarketingHostClient(): boolean {
  if (typeof window === "undefined") return false;
  return isMarketingHostname(window.location.hostname);
}

/** Link para rotas do produto: na LP usa origem do app; no app mantém path relativo. */
export function resolveProductHref(
  path: string,
  appOrigin: string,
  useAppOrigin: boolean,
): string {
  const raw = path.startsWith("/") ? path : `/${path}`;
  if (!useAppOrigin) return raw;
  const q = raw.indexOf("?");
  const pathname = q === -1 ? raw : raw.slice(0, q);
  const search = q === -1 ? "" : raw.slice(q);
  const base = appOrigin.replace(/\/+$/, "");
  return `${base}${pathname}${search}`;
}
