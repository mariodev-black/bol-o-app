import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import { calcPredictionPoints } from "@/lib/predictions";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

export type RegulationMatchResultUpdateInput = {
  matchId: number;
  resultCasa: number;
  resultVisitante: number;
  /** Se omitido, atualiza todas as linhas de matches_cache com esse match_id. */
  competitionIds?: number[];
  /** Atualiza provider_payload para o recálculo não sobrescrever com placar antigo da API. */
  patchProviderPayload?: boolean;
};

export type RegulationMatchPreviewRow = {
  prediction_id: string;
  ticket_id: string;
  user_email: string;
  score_casa: number;
  score_visitante: number;
  old_points: number | null;
  new_points: number;
  delta: number;
};

function patchProviderPayloadForRegulationScore(
  payload: Record<string, unknown> | null | undefined,
  resultCasa: number,
  resultVisitante: number,
): Record<string, unknown> {
  const base = payload && typeof payload === "object" ? { ...payload } : {};
  base.placar_mandante = resultCasa;
  base.placar_casa = resultCasa;
  base.placar_oficial_mandante = resultCasa;
  base.gols_mandante = resultCasa;
  base.placar_visitante = resultVisitante;
  base.placar_oficial_visitante = resultVisitante;
  base.gols_visitante = resultVisitante;
  base.placar = `${resultCasa} x ${resultVisitante}`;
  base.status = "FINALIZADO";
  if (base.gols && typeof base.gols === "object" && !Array.isArray(base.gols)) {
    const gols = base.gols as Record<string, unknown[]>;
    const filterRegulation = (list: unknown[]) =>
      (list ?? []).filter((g) => {
        const row = g as Record<string, unknown>;
        const periodo = String(row.periodo_slug ?? row.periodo ?? "").toLowerCase();
        return !periodo.includes("prorrog");
      });
    base.gols = {
      mandante: filterRegulation(gols.mandante as unknown[]),
      visitante: filterRegulation(gols.visitante as unknown[]),
    };
  }
  return base;
}

export async function listCompetitionIdsForMatch(
  client: PoolClient,
  matchId: number,
): Promise<number[]> {
  const { rows } = await client.query<{ competition_id: number }>(
    `SELECT DISTINCT competition_id FROM matches_cache WHERE match_id = $1 ORDER BY competition_id`,
    [matchId],
  );
  return rows.map((r) => Number(r.competition_id)).filter((n) => Number.isFinite(n) && n > 0);
}

export async function previewRegulationMatchRepontuation(
  client: PoolClient,
  input: RegulationMatchResultUpdateInput,
): Promise<RegulationMatchPreviewRow[]> {
  const { rows } = await client.query<{
    prediction_id: string;
    ticket_id: string;
    user_email: string;
    score_casa: number;
    score_visitante: number;
    old_points: number | null;
  }>(
    `SELECT p.id::text AS prediction_id,
            p.ticket_id::text AS ticket_id,
            u.email AS user_email,
            p.score_casa,
            p.score_visitante,
            ps.points AS old_points
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE p.match_id = $1
     ORDER BY ps.points DESC NULLS LAST, u.email ASC`,
    [input.matchId],
  );

  return rows.map((row) => {
    const calc = calcPredictionPoints(
      row.score_casa,
      row.score_visitante,
      input.resultCasa,
      input.resultVisitante,
    );
    const oldPoints = row.old_points ?? 0;
    return {
      ...row,
      new_points: calc.points,
      delta: calc.points - oldPoints,
    };
  });
}

export async function updateMatchResultToRegulationScore(
  client: PoolClient,
  input: RegulationMatchResultUpdateInput,
): Promise<{ competitionIdsUpdated: number[]; rowsUpdated: number }> {
  const matchId = Number(input.matchId);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    throw new Error("match_id inválido");
  }
  if (
    !Number.isInteger(input.resultCasa) ||
    !Number.isInteger(input.resultVisitante) ||
    input.resultCasa < 0 ||
    input.resultVisitante < 0
  ) {
    throw new Error("Placar inválido (inteiros >= 0)");
  }

  const competitionIds =
    input.competitionIds?.length
      ? [...new Set(input.competitionIds)]
      : await listCompetitionIdsForMatch(client, matchId);
  if (!competitionIds.length) {
    throw new Error(`Partida ${matchId} não encontrada em matches_cache`);
  }

  let rowsUpdated = 0;
  const patchPayload = input.patchProviderPayload !== false;

  for (const competitionId of competitionIds) {
    if (patchPayload) {
      const current = await client.query<{ provider_payload: Record<string, unknown> | null }>(
        `SELECT provider_payload FROM matches_cache WHERE competition_id = $1 AND match_id = $2`,
        [competitionId, matchId],
      );
      const payload = patchProviderPayloadForRegulationScore(
        current.rows[0]?.provider_payload,
        input.resultCasa,
        input.resultVisitante,
      );
      const { rowCount } = await client.query(
        `UPDATE matches_cache
         SET result_casa = $3,
             result_visitante = $4,
             status = 'FINALIZADO',
             disputa_penalti = false,
             penaltis_casa = NULL,
             penaltis_visitante = NULL,
             provider_payload = $5::jsonb,
             source_updated_at = now(),
             synced_at = now()
         WHERE competition_id = $1 AND match_id = $2`,
        [competitionId, matchId, input.resultCasa, input.resultVisitante, JSON.stringify(payload)],
      );
      rowsUpdated += rowCount ?? 0;
    } else {
      const { rowCount } = await client.query(
        `UPDATE matches_cache
         SET result_casa = $3,
             result_visitante = $4,
             status = 'FINALIZADO',
             source_updated_at = now(),
             synced_at = now()
         WHERE competition_id = $1 AND match_id = $2`,
        [competitionId, matchId, input.resultCasa, input.resultVisitante],
      );
      rowsUpdated += rowCount ?? 0;
    }
  }

  if (rowsUpdated === 0) {
    throw new Error(`Nenhuma linha atualizada para match_id=${matchId}`);
  }

  return { competitionIdsUpdated: competitionIds, rowsUpdated };
}

export async function applyRegulationMatchResultAndRecompute(
  input: RegulationMatchResultUpdateInput,
): Promise<{
  matchId: number;
  resultCasa: number;
  resultVisitante: number;
  competitionIdsUpdated: number[];
  predictionsUpdated: number;
  preview: RegulationMatchPreviewRow[];
}> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const preview = await previewRegulationMatchRepontuation(client, input);
    await client.query("BEGIN");
    const { competitionIdsUpdated } = await updateMatchResultToRegulationScore(client, input);
    const { updated } = await recomputePredictionScoresForMatches(client, [input.matchId]);
    await client.query("COMMIT");
    invalidateMatchMapMemoryAfterDbWrite();
    return {
      matchId: input.matchId,
      resultCasa: input.resultCasa,
      resultVisitante: input.resultVisitante,
      competitionIdsUpdated,
      predictionsUpdated: updated,
      preview,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
