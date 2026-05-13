import { NextRequest, NextResponse } from "next/server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { readMatchesCache } from "@/lib/matches-cache";
import { buildPartidasFasesFromRows } from "@/lib/partidas-cache-payload";

export const runtime = "nodejs";

/**
 * Somente Postgres (`matches_cache`). Não chama API Futebol — preenchimento via cron / bootstrap / rotas /cron/*.
 * `?competitionId=` opcional (default = campeonato principal); use o id do bolão extra para listar só aquele calendário.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("competitionId");
    const comp =
      raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))
        ? Number(raw)
        : getFootballMainCompetitionId();
    const rows = (await readMatchesCache()).filter((r) => Number(r.competition_id) === comp);
    const partidas = buildPartidasFasesFromRows(rows);
    return NextResponse.json(
      { partidas },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar partidas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
