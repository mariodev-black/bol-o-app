import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth/auth-user";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";

/** Usuário da sessão httpOnly (SSR) — evita flash de UI deslogada antes do `/me`. */
export async function getServerAuthUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token).catch(() => null);
  if (!userId) return null;

  return findUserById(userId);
}
