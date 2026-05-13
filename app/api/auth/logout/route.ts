import { NextRequest, NextResponse } from "next/server";
import { authLog, oauthRequestSnapshot } from "@/lib/auth/oauth-console";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, request);
  authLog("logout_ok", oauthRequestSnapshot(request));
  return res;
}
