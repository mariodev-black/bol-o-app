import { NextRequest, NextResponse } from "next/server";
import {
  getAllSyncedCompetitionIds,
  getFootballMainCompetitionId,
} from "@/lib/boloes-extra-config";
import { ensureMatchesCacheForCompetition } from "@/lib/ensure-matches-cache-competition";
import { readMatchesCache } from "@/lib/matches-cache";
import { buildPartidasFasesFromRows } from "@/lib/partidas-cache-payload";

export const runtime = "nodejs";

function partidasPayloadEmpty(partidas: Record<string, unknown>): boolean {
  return typeof partidas === "object" && partidas !== null && Object.keys(partidas).length === 0;
}

/**
 * Postgres (`matches_cache`). Se vazio para o campeonato e houver `FOOTBALL_API_TOKEN`, preenche uma vez via API-Futebol (igual ao cron).
 * `?competitionId=` opcional (default = campeonato principal); use o id do bolão extra para listar só aquele calendário.
 * `?allSynced=1` — principal + `BOLOES_EXTRA_CHAMPIONSHIP_IDS` (ex.: home “Próximos jogos”).
 */
export async function GET(request: NextRequest) {
  try {
    const allSynced = request.nextUrl.searchParams.get("allSynced") === "1";
    const raw = request.nextUrl.searchParams.get("competitionId");
    const comp =
      raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))
        ? Number(raw)
        : getFootballMainCompetitionId();
    const competitionIds = allSynced ? getAllSyncedCompetitionIds() : [comp];
    const idSet = new Set(competitionIds);

    let rows = (await readMatchesCache()).filter((r) =>
      idSet.has(Number(r.competition_id)),
    );
    let partidas = buildPartidasFasesFromRows(rows);
    if (partidasPayloadEmpty(partidas as Record<string, unknown>)) {
      for (const competitionId of competitionIds) {
        try {
          await ensureMatchesCacheForCompetition(competitionId);
        } catch (e) {
          console.error("[api/partidas] ensure cache failed", {
            competitionId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      rows = (await readMatchesCache()).filter((r) =>
        idSet.has(Number(r.competition_id)),
      );
      partidas = buildPartidasFasesFromRows(rows);
    }
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
