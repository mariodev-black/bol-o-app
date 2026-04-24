import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listUsersReferredBy } from "@/lib/auth/users";
import { buildAffiliateSummaryForUser } from "@/lib/referrals/summary";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  let userId: string;
  try {
    userId = (await verifySessionToken(token)) ?? "";
  } catch {
    return NextResponse.json({ error: "Sessao invalida" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const signups = await listUsersReferredBy(userId);
    const summary = await buildAffiliateSummaryForUser(userId, signups);
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("[affiliate/summary]", e);
    return NextResponse.json({ error: "Nao foi possivel carregar resumo de afiliado" }, { status: 500 });
  }
}
