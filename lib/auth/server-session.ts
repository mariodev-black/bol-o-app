import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth/auth-user";
import { enrichAuthUserWithSkaleFunnelFromCookie } from "@/lib/auth/skale-funnel-auth";
import { SKALE_FUNNEL_COOKIE } from "@/lib/boloes/skale-funnel-shared";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";

/** Usuário da sessão httpOnly (SSR) — evita flash de UI deslogada antes do `/me`. */
export async function getServerAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token).catch(() => null);
  if (!userId) return null;

  const user = await findUserById(userId);
  if (!user) return null;

  return enrichAuthUserWithSkaleFunnelFromCookie(
    user,
    cookieStore.get(SKALE_FUNNEL_COOKIE)?.value,
  );
}
