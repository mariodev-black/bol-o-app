import { NextRequest, NextResponse } from "next/server";
import {
  getAllSyncedCompetitionIds,
  getFootballMainCompetitionId,
} from "@/lib/boloes-extra-config";
import { readMatchesCache } from "@/lib/matches-cache";
import { buildPartidasFasesFromRows } from "@/lib/partidas-cache-payload";
import { syncAllConfiguredIfStale } from "@/lib/football/sync-orchestrator";

export const runtime = "nodejs";

function partidasPayloadEmpty(partidas: Record<string, unknown>): boolean {
  return typeof partidas === "object" && partidas !== null && Object.keys(partidas).length === 0;
}

/**
 * Le `matches_cache` (Postgres). Se a tabela estiver completamente vazia (deploy
 * recente / banco novo), dispara o syncAllConfiguredIfStale do scheduler v2 para
 * popular sob demanda — sem chamar API se o cache ja existe.
 *
 * Query params:
 *   ?competitionId=N    — competicao especifica (default = FOOTBALL_COMPETITION_ID).
 *   ?allSynced=1        — principal + BOLOES_EXTRA_CHAMPIONSHIP_IDS.
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

    let rows = (await readMatchesCache()).filter((r) => idSet.has(Number(r.competition_id)));
    let partidas = buildPartidasFasesFromRows(rows);
    if (partidasPayloadEmpty(partidas as Record<string, unknown>)) {
      try {
        await syncAllConfiguredIfStale();
      } catch (e) {
        console.error("[api/partidas] syncAllConfiguredIfStale failed", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
      rows = (await readMatchesCache()).filter((r) => idSet.has(Number(r.competition_id)));
      partidas = buildPartidasFasesFromRows(rows);
    }
    return NextResponse.json(
      { partidas },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar partidas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
