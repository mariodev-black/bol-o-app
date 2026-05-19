/**
 * Brinde "Bolão extra grátis" da rodada atual.
 *
 *   GET  → estado do brinde para o usuário logado (já resgatado? rodada atual?).
 *   POST → resgata (idempotente). Retorna `ticketId` para o front redirecionar
 *          o usuário direto para `/palpites?ticket=<id>` após o segundo modal.
 *
 * Ambas exigem sessão. Sem auth → 401.
 */

import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  claimExtraGiftForUser,
  getExtraGiftStatusForUser,
} from "@/lib/promotions/extra-gift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const status = await getExtraGiftStatusForUser(user.id);
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const result = await claimExtraGiftForUser(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result);
}
