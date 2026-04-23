import * as jose from "jose";
import type { NextResponse } from "next/server";

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

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function attachSessionCookie(res: NextResponse, userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  res.cookies.set(sessionCookieName(), token, sessionCookieOptions());
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(sessionCookieName(), "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}
