import { NextRequest, NextResponse } from "next/server";
import { oauthLog, oauthRequestSnapshot, oauthWarn } from "@/lib/auth/oauth-console";
import { enrichAuthUserWithSkaleFunnel } from "@/lib/auth/skale-funnel-auth";
import { clearSessionCookie, sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { syncSkaleFunnelCookies } from "@/lib/boloes/skale-funnel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authDebug = process.env.AUTH_DEBUG === "1";

  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    if (authDebug) {
      oauthLog("me_no_session_cookie", oauthRequestSnapshot(request));
    }
    return NextResponse.json({ user: null });
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch (e) {
    oauthWarn("me_jwt_verify_threw", {
      message: e instanceof Error ? e.message : String(e),
      ...oauthRequestSnapshot(request),
    });
    const res = NextResponse.json({ user: null });
    clearSessionCookie(res, request);
    return res;
  }

  if (!userId) {
    oauthWarn("me_jwt_invalid_or_expired", oauthRequestSnapshot(request));
    const res = NextResponse.json({ user: null });
    clearSessionCookie(res, request);
    return res;
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      oauthWarn("me_user_not_in_db", {
        userIdPrefix: `${userId.slice(0, 8)}…`,
        ...oauthRequestSnapshot(request),
      });
      const res = NextResponse.json({ user: null });
      clearSessionCookie(res, request);
      return res;
    }
    if (authDebug) {
      oauthLog("me_ok", {
        userIdPrefix: `${user.id.slice(0, 8)}…`,
        emailDomain: user.email?.includes("@") ? user.email.split("@")[1] : undefined,
      });
    }
    const enriched = await enrichAuthUserWithSkaleFunnel(user, request);
    const res = NextResponse.json({ user: enriched });
    await syncSkaleFunnelCookies(res, request, user.id);
    return res;
  } catch (e) {
    console.error("[auth/me]", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
