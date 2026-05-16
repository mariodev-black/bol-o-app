import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildRankingScopes } from "@/lib/ranking/scopes";

export { type RankingScopeOption } from "@/lib/ranking/scopes-shared";

export const runtime = "nodejs";

async function authUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const defaultRequested = request.nextUrl.searchParams.get("default")?.trim() || null;
  const { scopes, defaultKey, hasAnyTicket } = await buildRankingScopes(userId, { defaultRequested });

  return NextResponse.json({
    scopes,
    defaultKey,
    hasAnyTicket,
  });
}
