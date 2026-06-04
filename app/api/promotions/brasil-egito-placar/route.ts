/**
 * Promo "Placar exato — Amistoso Brasil x Egito".
 *
 *   GET  → elegibilidade + link de indicação.
 *   POST → salva palpite promocional (step 1 → step 2).
 */

import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  getBrasilEgitoPlacarPromoStatusForUser,
  submitBrasilEgitoPlacarPromoForUser,
} from "@/lib/promotions/brasil-egito-placar-promo";
import { invalidatePromoHubCache } from "@/lib/promotions/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const status = await getBrasilEgitoPlacarPromoStatusForUser(user.id);
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { predCasa?: unknown; predVisitante?: unknown };
  try {
    body = (await req.json()) as { predCasa?: unknown; predVisitante?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const predCasa = Number(body.predCasa);
  const predVisitante = Number(body.predVisitante);
  const result = await submitBrasilEgitoPlacarPromoForUser(
    user.id,
    predCasa,
    predVisitante,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  invalidatePromoHubCache(user.id);
  return NextResponse.json(result.status);
}
