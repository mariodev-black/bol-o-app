import { NextRequest, NextResponse } from "next/server";
import { bootstrapEmailOnStartup } from "@/lib/email/bootstrap";
import { runPixRecoveryCopa } from "@/lib/email/campaigns/pix-recovery-copa-2026";

export const runtime = "nodejs";
/** Verifica todos os 8 steps — pode levar vários minutos em base grande. */
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
 * Recuperação de PIX abandonado — Copa Bolão 2026.
 *
 * Roda a cada 30 min (10 e 11 Jun–15 Jun) e verifica os 8 steps:
 *   r01_15min | r02_2h | r03_6h | r04_12h_agressivo
 *   r05_24h   | r06_36h_ganancia | r07_48h | r08_72h
 *
 * `?dryRun=1` — lista elegíveis sem enviar.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun");
  const shouldDryRun = dryRun === "1" || dryRun === "true";

  try {
    await bootstrapEmailOnStartup();
    const result = await runPixRecoveryCopa({ dryRun: shouldDryRun });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na recuperacao de PIX";
    console.error("[cron] email-pix-recovery-copa", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
