import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listUserWithdrawalHistory } from "@/lib/referrals/withdrawHistory";

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

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;

  try {
    const items = await listUserWithdrawalHistory(userId, Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[affiliate/withdraw/history]", e);
    return NextResponse.json({ error: "Erro ao carregar historico" }, { status: 500 });
  }
}
