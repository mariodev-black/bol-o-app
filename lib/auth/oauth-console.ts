import type { NextRequest } from "next/server";
import { canonicalHostname, forwardingHostRaw, getOAuthPublicOrigin } from "@/lib/auth/request-host";
import { cookieUseSecure, sessionCookieDomain } from "@/lib/auth/session";

/** Prefixo único para filtrar nos logs (Vercel / Docker). */
const P = "[oauth]";

export function oauthLog(tag: string, fields: Record<string, unknown> = {}): void {
  console.log(P, tag, fields);
}

export function oauthWarn(tag: string, fields: Record<string, unknown> = {}): void {
  console.warn(P, tag, fields);
}

export function oauthErr(tag: string, fields: Record<string, unknown> = {}): void {
  console.error(P, tag, fields);
}

/** Contexto HTTP seguro (sem tokens, sem state completo). */
export function oauthRequestSnapshot(request: NextRequest): Record<string, unknown> {
  return {
    forwardingHost: forwardingHostRaw(request) || "(empty)",
    canonicalHost: canonicalHostname(request) || "(empty)",
    publicOrigin: getOAuthPublicOrigin(request),
    nextUrlOrigin: request.nextUrl.origin,
    xfProto: request.headers.get("x-forwarded-proto") ?? "(empty)",
    xfHost: request.headers.get("x-forwarded-host") ?? "(empty)",
    host: request.headers.get("host") ?? "(empty)",
    cookieDomain: sessionCookieDomain(request) ?? "(host-only)",
    secureCookies: cookieUseSecure(request),
  };
}

const AUTH_P = "[auth]";

export function authLog(tag: string, fields: Record<string, unknown> = {}): void {
  console.log(AUTH_P, tag, fields);
}
