import { NextRequest, NextResponse } from "next/server";
import { runMaintenanceTick } from "@/lib/cron/maintenance-tick";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (isVercelCron) return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  return querySecret === secret;
}

/**
 * Ciclo unico: sync de partidas (quando aplicavel) + garantia de resultados + processamento de premios.
 * Em producao auto-hospedada, prefira INTERNAL_CRON_ENABLED no processo Node; esta rota serve para ping manual ou monitoramento.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  try {
    const result = await runMaintenanceTick();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no tick de manutencao";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
