import * as jose from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { canonicalHostname, productionSessionCookieDomain } from "@/lib/auth/request-host";

/** Sessão somente via cookie httpOnly (JWT); não use localStorage para login. */
const COOKIE_NAME = "bolao_session";

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function cookieUseSecure(request?: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (!request) return false;
  const p = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return p === "https";
}

export function sessionCookieDomain(request?: NextRequest): string | undefined {
  const fromEnv = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (fromEnv) return fromEnv;

  const host =
    request != null
      ? canonicalHostname(request)
      : (() => {
          try {
            return new URL(process.env.APP_URL || "http://localhost").hostname.toLowerCase();
          } catch {
            return "";
          }
        })();

  return productionSessionCookieDomain(host);
}

export function sessionCookieOptions(request?: NextRequest): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const domain = sessionCookieDomain(request);
  const base = {
    httpOnly: true,
    secure: cookieUseSecure(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  return domain ? { ...base, domain } : base;
}

/** Cookies de curta duração do fluxo OAuth (state / ref / return). */
export function oauthStateCookieOptions(request?: NextRequest) {
  const domain = sessionCookieDomain(request);
  const base = {
    httpOnly: true,
    secure: cookieUseSecure(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  return domain ? { ...base, domain } : base;
}

export async function attachSessionCookie(
  res: NextResponse,
  userId: string,
  request?: NextRequest
): Promise<void> {
  const token = await signSessionToken(userId);
  res.cookies.set(sessionCookieName(), token, sessionCookieOptions(request));
}

export function clearSessionCookie(res: NextResponse, request?: NextRequest): void {
  res.cookies.set(sessionCookieName(), "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  });
}
