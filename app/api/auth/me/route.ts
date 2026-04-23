import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    const res = NextResponse.json({ user: null });
    res.cookies.set(sessionCookieName(), "", { maxAge: 0, path: "/" });
    return res;
  }

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      const res = NextResponse.json({ user: null });
      clearSessionCookie(res);
      return res;
    }
    return NextResponse.json({ user });
  } catch (e) {
    console.error("[auth/me]", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
