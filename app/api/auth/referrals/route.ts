import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listUsersReferredBy } from "@/lib/auth/users";

export const runtime = "nodejs";

/** Lista quem se cadastrou usando o seu código de indicação. Requer sessão. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const referrals = await listUsersReferredBy(userId);
    return NextResponse.json({ referrals });
  } catch (e) {
    console.error("[auth/referrals]", e);
    return NextResponse.json({ error: "Não foi possível listar indicações" }, { status: 500 });
  }
}
