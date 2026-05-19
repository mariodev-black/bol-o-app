import { NextRequest, NextResponse } from "next/server";
import { maybeRunDailyFullSync } from "@/lib/football/scheduler-v2";
import { syncAllConfigured } from "@/lib/football/sync-orchestrator";

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
 * Daily full sync (arquitetura v2):
 *   - GET sem `force` -> so roda na janela 00:01-00:30 BRT e 1x por dia (idempotente).
 *   - GET com ?force=1 -> roda agora, sem checar janela.
 *
 * Recomendado: Vercel Cron em ~00:05 BRT (= 03:05 UTC) chamando sem `force`.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const force = request.nextUrl.searchParams.get("force");
  const shouldForce = force === "1" || force === "true";
  try {
    if (shouldForce) {
      const result = await syncAllConfigured();
      return NextResponse.json({ ok: true, forced: true, result });
    }
    const result = await maybeRunDailyFullSync();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no daily full sync";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
