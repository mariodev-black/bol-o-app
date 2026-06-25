import { resolveTicketMatchCompetitionIds } from "@/lib/admin/ticket-scope-stats";
import type { TicketScopeInput } from "@/lib/admin/ticket-scope-stats";
import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

export async function adminUpdateMatchResultInCache(input: {
  matchId: number;
  resultCasa: number;
  resultVisitante: number;
  competitionIds: number[];
}): Promise<void> {
  const matchId = Number(input.matchId);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    throw new Error("Partida inválida");
  }
  if (
    !Number.isInteger(input.resultCasa) ||
    !Number.isInteger(input.resultVisitante) ||
    input.resultCasa < 0 ||
    input.resultVisitante < 0
  ) {
    throw new Error("Placar oficial inválido (0–99)");
  }

  const competitionIds = [...new Set(input.competitionIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!competitionIds.length) {
    throw new Error("Competição da partida não encontrada");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE matches_cache
       SET result_casa = $2,
           result_visitante = $3,
           source_updated_at = now(),
           synced_at = now()
       WHERE match_id = $1
         AND competition_id = ANY($4::int[])`,
      [matchId, input.resultCasa, input.resultVisitante, competitionIds],
    );
    if (!rowCount) {
      throw new Error("Partida não encontrada no cache");
    }
    await recomputePredictionScoresForMatches(client, [matchId]);
    await client.query("COMMIT");
    invalidateMatchMapMemoryAfterDbWrite();
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function competitionIdsForAdminTicketMatch(
  ticket: TicketScopeInput,
  competitionId?: number | null,
): number[] {
  const scoped = resolveTicketMatchCompetitionIds(ticket);
  if (competitionId != null && Number.isFinite(competitionId) && competitionId > 0) {
    return [...new Set([...scoped, competitionId])];
  }
  return scoped;
}
