import { NextRequest, NextResponse } from "next/server";
import { runRealtimeTick } from "@/lib/football/realtime-worker";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  return (request.nextUrl.searchParams.get("secret") || "") === secret;
}

/**
 * Worker em tempo real (arquitetura v2). Chamar a cada 1 min (Vercel Cron / cron externo).
 *
 * Em ambiente PM2/VM com INTERNAL_CRON_ENABLED=true o scheduler interno ja roda
 * este tick automaticamente — esta rota e para Vercel ou ping manual.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  try {
    const result = await runRealtimeTick();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no realtime tick";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
