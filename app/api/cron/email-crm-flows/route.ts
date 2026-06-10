import { NextRequest, NextResponse } from "next/server";
import { bootstrapEmailOnStartup } from "@/lib/email/bootstrap";
import { runAllCrmFlows } from "@/lib/email/campaigns/crm-flows";

export const runtime = "nodejs";
/** Verifica os 4 fluxos de CRM — pode levar minutos em base grande. */
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
 * CRM por evento — Bolão do Milhão.
 *
 * Roda de hora em hora e verifica os fluxos:
 *   pos_compra_upsell | comprou_indique | prova_social | checkout_recovery
 *
 * `?dryRun=1` — lista elegíveis sem enviar.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  const dryRun = dryRunParam === "1" || dryRunParam === "true";

  try {
    await bootstrapEmailOnStartup();
    const result = await runAllCrmFlows({ dryRun });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no CRM de e-mails";
    console.error("[cron] email-crm-flows", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
