/**
 * Promo "Placar exato — Amistoso Brasil x Marrocos".
 *
 *   GET  → elegibilidade + link de indicação.
 *   POST → salva palpite promocional (step 1 → step 2).
 */

import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  getBrasilMarrocosPlacarPromoStatusForUser,
  submitBrasilMarrocosPlacarPromoForUser,
} from "@/lib/promotions/brasil-marrocos-placar-promo";
import { invalidatePromoHubCache } from "@/lib/promotions/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const status = await getBrasilMarrocosPlacarPromoStatusForUser(user.id);
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { predCasa?: unknown; predVisitante?: unknown; escanteiosBrasil?: unknown };
  try {
    body = (await req.json()) as { predCasa?: unknown; predVisitante?: unknown; escanteiosBrasil?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const predCasa = Number(body.predCasa);
  const predVisitante = Number(body.predVisitante);
  const escanteiosBrasil = Number(body.escanteiosBrasil ?? 0);
  const result = await submitBrasilMarrocosPlacarPromoForUser(
    user.id,
    predCasa,
    predVisitante,
    escanteiosBrasil,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  invalidatePromoHubCache(user.id);
  return NextResponse.json(result.status);
}
