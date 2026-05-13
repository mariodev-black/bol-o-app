import { NextRequest, NextResponse } from "next/server";
import { fetchProviderMatchesForAllSyncedCompetitions } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";
import { runFootballSnapshotsFromApi } from "@/lib/cron/tasks/footballSnapshotsTask";

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
 * Atualiza cache local (tabela + fases) consumindo a API Futebol em lote.
 * Em producao: agende `curl` 1x/dia (ex.: 0 1 * * *) para nao depender do tick de 5 min na janela 00:00–00:05.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  try {
    const result = await runFootballSnapshotsFromApi();
    const matches = await syncMatchesCache({ fetchProviderMatches: fetchProviderMatchesForAllSyncedCompetitions, force: true });
    return NextResponse.json({ ok: true, result, matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar snapshots";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
