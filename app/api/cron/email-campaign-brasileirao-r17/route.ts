import { NextRequest, NextResponse } from "next/server";
import { runBrasileiraoR17Campaign } from "@/lib/email/campaigns/brasileirao-r17-reminder";

export const runtime = "nodejs";
/** Campanha em massa pode levar vários minutos. */
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  return (request.nextUrl.searchParams.get("secret") || "") === secret;
}

/**
 * Disparo da campanha 17ª rodada Brasileirão.
 *
 * Agendado: 20/05/2026 09:12 BRT (12:12 UTC) via vercel.json.
 * `?force=1` — ignora horário (mantém dedupe por e-mail no banco).
 * `?dryRun=1` — lista destinatários sem enviar.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force");
  const dryRun = request.nextUrl.searchParams.get("dryRun");
  const shouldForce = force === "1" || force === "true";
  const shouldDryRun = dryRun === "1" || dryRun === "true";

  try {
    const result = await runBrasileiraoR17Campaign({
      force: shouldForce,
      dryRun: shouldDryRun,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na campanha de e-mail";
    console.error("[cron] email-campaign-brasileirao-r17", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
