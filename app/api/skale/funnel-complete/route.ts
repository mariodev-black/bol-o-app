import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import {
  clearSkaleFunnelCookies,
  hasSkaleFunnelCookie,
  userHasPaidSkaleTicket,
} from "@/lib/boloes/skale-funnel";

export const runtime = "nodejs";

/** Limpa cookies do funil Skale após pagamento confirmado. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = await verifySessionToken(token).catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  if (!hasSkaleFunnelCookie(request)) {
    return NextResponse.json({ unlocked: true });
  }

  const hasTicket = await userHasPaidSkaleTicket(userId);
  if (!hasTicket) {
    return NextResponse.json(
      { error: "Cota Skale ainda não confirmada" },
      { status: 409 },
    );
  }

  const res = NextResponse.json({ unlocked: true });
  clearSkaleFunnelCookies(res);
  return res;
}
