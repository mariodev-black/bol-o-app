import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import {
  AMISTOSOS_FRIENDLY_MATCHES,
  getAmistososFriendliesCompetitionId,
} from "@/lib/football/amistosos-friendlies";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

export type AmistososMatchResultInput = {
  matchId: number;
  resultCasa: number;
  resultVisitante: number;
};

/**
 * Atualiza vários placares do bolão amistosos e recomputa pontuação — mesma
 * lógica do PATCH /api/admin/amistosos-matches, em lote atômico.
 */
export async function finalizeAmistososFriendliesResults(
  results: AmistososMatchResultInput[],
): Promise<
  | { ok: true; matchIds: number[]; predictionsUpdated: number }
  | { ok: false; error: string }
> {
  if (results.length === 0) {
    return { ok: false, error: "Nenhum placar informado." };
  }

  const allowed = new Set(AMISTOSOS_FRIENDLY_MATCHES.map((m) => m.matchId));

  for (const row of results) {
    if (
      !allowed.has(row.matchId) ||
      !Number.isFinite(row.resultCasa) ||
      !Number.isFinite(row.resultVisitante) ||
      row.resultCasa < 0 ||
      row.resultVisitante < 0
    ) {
      return {
        ok: false,
        error: `Placar inválido ou partida desconhecida: ${row.matchId}.`,
      };
    }
  }

  const { ensureAmistososFriendliesMatchesSeeded } = await import(
    "@/lib/football/amistosos-friendlies-seed"
  );
  await ensureAmistososFriendliesMatchesSeeded();

  const pool = getPool();
  const competitionId = getAmistososFriendliesCompetitionId();
  const client = await pool.connect();
  const matchIds = results.map((r) => r.matchId);

  try {
    await client.query("BEGIN");

    for (const row of results) {
      const { rowCount } = await client.query(
        `UPDATE matches_cache
         SET result_casa = $3,
             result_visitante = $4,
             status = 'FINALIZADO',
             source_updated_at = now(),
             synced_at = now()
         WHERE competition_id = $1 AND match_id = $2`,
        [competitionId, row.matchId, row.resultCasa, row.resultVisitante],
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: `Partida ${row.matchId} não encontrada.` };
      }
    }

    const recompute = await recomputePredictionScoresForMatches(client, matchIds);

    await client.query("COMMIT");
    invalidateMatchMapMemoryAfterDbWrite();

    return {
      ok: true,
      matchIds,
      predictionsUpdated: recompute.updated,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[amistosos] finalizeAmistososFriendliesResults", err);
    return { ok: false, error: "Falha ao finalizar placares." };
  } finally {
    client.release();
  }
}
