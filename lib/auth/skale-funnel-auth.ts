import type { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth/auth-user";
import type { PublicUser } from "@/lib/auth/users";
import {
  hasSkaleFunnelCookie,
  syncSkaleFunnelCookies,
  userHasPaidSkaleTicket,
} from "@/lib/boloes/skale-funnel";

export async function resolveSkaleFunnelLocked(
  userId: string,
  hasFunnelCookie: boolean,
): Promise<boolean> {
  if (!hasFunnelCookie) return false;
  return !(await userHasPaidSkaleTicket(userId));
}

export async function enrichAuthUserWithSkaleFunnel(
  user: PublicUser,
  request: NextRequest,
  response?: NextResponse,
): Promise<AuthUser> {
  if (response) {
    const locked = await syncSkaleFunnelCookies(response, request, user.id);
    return { ...user, skaleFunnelLocked: locked };
  }

  const locked = await resolveSkaleFunnelLocked(
    user.id,
    hasSkaleFunnelCookie(request),
  );
  return { ...user, skaleFunnelLocked: locked };
}

export async function enrichAuthUserWithSkaleFunnelFromCookie(
  user: PublicUser,
  funnelCookieValue: string | undefined,
): Promise<AuthUser> {
  const locked = await resolveSkaleFunnelLocked(
    user.id,
    funnelCookieValue === "1",
  );
  return { ...user, skaleFunnelLocked: locked };
}
