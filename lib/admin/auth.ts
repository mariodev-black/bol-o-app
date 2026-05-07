import * as jose from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

const ADMIN_2FA_COOKIE = "bolao_admin_2fa";
const ADMIN_2FA_MAX_AGE = 60 * 60 * 2;

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "super_admin";
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

export function admin2faCookieName(): string {
  return ADMIN_2FA_COOKIE;
}

export function admin2faCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: ADMIN_2FA_MAX_AGE,
  };
}

export async function findAdminUserById(userId: string): Promise<AdminUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    admin_2fa_enabled: boolean | null;
    admin_2fa_secret: string | null;
  }>(
    `SELECT id, email, name, role, admin_2fa_enabled, admin_2fa_secret
     FROM users
     WHERE id = $1
       AND role IN ('admin', 'super_admin')
     LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "super_admin" ? "super_admin" : "admin",
    twoFactorEnabled: Boolean(row.admin_2fa_enabled),
    twoFactorSecret: row.admin_2fa_secret,
  };
}

export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;
  return userId ? findAdminUserById(userId) : null;
}

export async function signAdmin2faToken(userId: string): Promise<string> {
  return new jose.SignJWT({ scope: "admin_2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(getSecretKey());
}

export async function verifyAdmin2faToken(token: string, userId: string): Promise<boolean> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());
    return payload.sub === userId && payload.scope === "admin_2fa";
  } catch {
    return false;
  }
}

export async function hasValidAdmin2fa(userId: string): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_2FA_COOKIE)?.value;
  return token ? verifyAdmin2faToken(token, userId) : false;
}

export async function requireAdmin(options?: { require2fa?: boolean }): Promise<AdminUser> {
  const admin = await getCurrentAdminUser();
  if (!admin) redirect("/login?from=/admin");
  if (options?.require2fa !== false) {
    if (!admin.twoFactorEnabled) redirect("/admin/2fa");
    if (!(await hasValidAdmin2fa(admin.id))) redirect("/login?from=/admin");
  }
  return admin;
}

export async function setAdmin2faCookie(res: NextResponse, userId: string): Promise<void> {
  const token = await signAdmin2faToken(userId);
  res.cookies.set(ADMIN_2FA_COOKIE, token, admin2faCookieOptions());
}
