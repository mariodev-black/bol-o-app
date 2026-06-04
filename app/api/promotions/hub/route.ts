/**
 * Hub de promoções ativas para o usuário logado.
 */

import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getPromoHubForUser } from "@/lib/promotions/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const hub = await getPromoHubForUser(user.id);
  return NextResponse.json(hub, { headers: { "cache-control": "no-store" } });
}
