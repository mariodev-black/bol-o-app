import { NextRequest, NextResponse } from "next/server";
import { clearAdmin2faCookie } from "@/lib/admin/auth";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, request);
  clearAdmin2faCookie(res);
  return res;
}
