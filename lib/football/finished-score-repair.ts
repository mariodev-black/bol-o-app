/**
 * Reparo de placares de partidas já encerradas.
 *
 * O endpoint hierárquico GET /campeonatos/:id/partidas costuma trazer apenas
 * `status: finalizado` sem `placar_mandante` / `placar_visitante`. O worker
 * realtime só cobre ~90 min após o apito — jogos de ontem ficam 0×0 para sempre.
 *
 * Este módulo reconsulta GET /partidas/:id para candidatos suspeitos e persiste
 * o placar oficial via `persistMatchesV2`.
 */

import { getPool } from "@/lib/db";
import { getFootballApiSyncExcludedCompetitionIds } from "@/lib/football/amistosos-friendlies-config";
import { fetchMatchDetailById } from "@/lib/football/provider";
import { persistMatchesV2 } from "@/lib/football/persistence";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";

function intEnv(name: string, fallback: number, min = 1, max = 500): number {
  const n = Number.parseInt((process.env[name] || "").trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function repairLookbackDays(): number {
  return intEnv("FINISHED_SCORE_REPAIR_LOOKBACK_DAYS", 21, 1, 60);
}

function repairMaxPerRun(): number {
  return intEnv("FINISHED_SCORE_REPAIR_MAX_PER_RUN", 40, 1, 200);
}

/** Minutos após o apito para considerar que o jogo já deveria ter acabado. */
function repairStaleAfterMinutes(): number {
  return intEnv("FINISHED_SCORE_REPAIR_STALE_AFTER_MINUTES", 105, 90, 240);
}

const SELECT_CANDIDATES_SQL = `
SELECT competition_id, match_id
  FROM matches_cache mc
 WHERE kickoff_at IS NOT NULL
   AND kickoff_at <= now() - ($1::text || ' minutes')::interval
   AND kickoff_at >= now() - ($2::text || ' days')::interval
   AND NOT (mc.competition_id = ANY($4::int[]))
   AND lower(coalesce(mc.status, '')) NOT LIKE '%cancel%'
   AND lower(coalesce(mc.status, '')) NOT LIKE '%adiad%'
   AND lower(coalesce(mc.status, '')) NOT LIKE '%suspens%'
   AND lower(coalesce(mc.status, '')) NOT LIKE '%interromp%'
   AND (
     (
       (lower(coalesce(mc.status, '')) LIKE '%finaliz%'
         OR lower(coalesce(mc.status, '')) LIKE '%encerr%')
       AND (
         mc.result_casa IS NULL
         OR mc.result_visitante IS NULL
         OR (
           coalesce(mc.result_casa, 0) = 0
           AND coalesce(mc.result_visitante, 0) = 0
           AND coalesce(mc.provider_payload->>'placar_mandante', '') = ''
           AND coalesce(mc.provider_payload->>'placar_visitante', '') = ''
           AND coalesce(mc.provider_payload->>'placar', '') !~ '\\d+\\s*[xX]\\s*\\d+'
         )
       )
     )
     OR (
       lower(coalesce(mc.status, '')) LIKE '%andamento%'
       OR lower(coalesce(mc.status, '')) LIKE '%intervalo%'
       OR lower(coalesce(mc.status, '')) LIKE '%vivo%'
       OR lower(coalesce(mc.status, '')) LIKE '%em curso%'
       OR (
         lower(coalesce(mc.status, '')) LIKE '%agendado%'
         OR lower(coalesce(mc.status, '')) LIKE '%pre%jogo%'
       )
     )
     OR (
       (lower(coalesce(mc.status, '')) LIKE '%finaliz%'
         OR lower(coalesce(mc.status, '')) LIKE '%encerr%')
       AND (
         lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%andamento%'
         OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%intervalo%'
         OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%vivo%'
         OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%em curso%'
       )
     )
   )
 ORDER BY kickoff_at DESC
 LIMIT $3
`;

export type FinishedScoreRepairResult = {
  candidates: number;
  fetched: number;
  persisted: number;
  scoredChangedIds: number[];
  predictionScoresUpdated: number;
  ms: number;
};

/**
 * Busca placar oficial via /partidas/:id para jogos com cache suspeito ou
 * desatualizado e regrava `matches_cache` (+ espelho Skale quando for a Copa).
 */
export async function repairFinishedMatchScores(opts?: {
  limit?: number;
  lookbackDays?: number;
  /** Reparo pontual (ex.: partidas de ontem). */
  matchIds?: number[];
}): Promise<FinishedScoreRepairResult> {
  const t0 = Date.now();
  const pool = getPool();
  const limit = opts?.limit ?? repairMaxPerRun();
  const lookbackDays = opts?.lookbackDays ?? repairLookbackDays();
  const staleMin = repairStaleAfterMinutes();
  const excluded = getFootballApiSyncExcludedCompetitionIds();

  let rows: Array<{ competition_id: number; match_id: number }>;

  if (opts?.matchIds?.length) {
    const ids = opts.matchIds.filter((id) => Number.isFinite(id) && id > 0);
    const { rows: targeted } = await pool.query<{ competition_id: number; match_id: number }>(
      `SELECT competition_id, match_id
         FROM matches_cache
        WHERE match_id = ANY($1::int[])
          AND NOT (competition_id = ANY($2::int[]))
        ORDER BY kickoff_at DESC NULLS LAST`,
      [ids, excluded],
    );
    rows = targeted;
  } else {
    const result = await pool.query<{ competition_id: number; match_id: number }>(
      SELECT_CANDIDATES_SQL,
      [String(staleMin), String(lookbackDays), limit, excluded],
    );
    rows = result.rows;
  }

  if (rows.length === 0) {
    return {
      candidates: 0,
      fetched: 0,
      persisted: 0,
      scoredChangedIds: [],
      predictionScoresUpdated: 0,
      ms: Date.now() - t0,
    };
  }

  const updates = [];
  for (const row of rows) {
    try {
      const detail = await fetchMatchDetailById(Number(row.match_id));
      if (!detail) continue;
      updates.push({
        ...detail,
        competitionId: detail.competitionId || Number(row.competition_id),
      });
    } catch (err) {
      console.warn(`[finished-score-repair] partida ${row.match_id}:`, err);
    }
  }

  if (updates.length === 0) {
    return {
      candidates: rows.length,
      fetched: 0,
      persisted: 0,
      scoredChangedIds: [],
      predictionScoresUpdated: 0,
      ms: Date.now() - t0,
    };
  }

  const persisted = await persistMatchesV2(updates, {
    cascadeSource: "finished-score-repair",
    // Fechamento de prêmios pode travar em bolões grandes; placar + prediction_scores
    // já são gravados dentro de persistMatchesV2. Revalidate do ranking segue na cascata.
    runCascadingClosures: false,
  });

  const mainId = getFootballMainCompetitionId();
  if (updates.some((m) => Number(m.competitionId) === mainId)) {
    try {
      const { mirrorAllSkaleBolaoMatchesFromCopa } = await import(
        "@/lib/football/skale-bolao-sync"
      );
      await mirrorAllSkaleBolaoMatchesFromCopa();
    } catch (err) {
      console.warn("[finished-score-repair] mirror Skale:", err);
    }
  }

  return {
    candidates: rows.length,
    fetched: updates.length,
    persisted: persisted.written,
    scoredChangedIds: persisted.scoredChangedIds,
    predictionScoresUpdated: persisted.predictionScoresUpdated,
    ms: Date.now() - t0,
  };
}

export type RegulationScoreRepairResult = {
  candidates: number;
  repaired: number;
  matchIds: number[];
  predictionScoresUpdated: number;
  ms: number;
};

/**
 * Corrige placares gravados com gols de prorrogação.
 * O bolão pontua apenas 1º e 2º tempo (+ acréscimos).
 */
export async function repairRegulationTimeScores(opts?: {
  lookbackDays?: number;
}): Promise<RegulationScoreRepairResult> {
  const t0 = Date.now();
  const pool = getPool();
  const lookbackDays = opts?.lookbackDays ?? repairLookbackDays();
  const mainId = getFootballMainCompetitionId();

  const { rows } = await pool.query<{
    match_id: number;
    result_casa: number | null;
    result_visitante: number | null;
    provider_payload: Record<string, unknown> | null;
  }>(
    `SELECT match_id, result_casa, result_visitante, provider_payload
       FROM matches_cache
      WHERE competition_id = $1
        AND kickoff_at >= now() - ($2::text || ' days')::interval
        AND lower(coalesce(status, '')) LIKE '%finaliz%'
        AND provider_payload::text ILIKE '%prorrogação%'`,
    [mainId, String(lookbackDays)],
  );

  const { countRegulationGoalsFromPartidaPayload } = await import("@/lib/partida-placar");
  const { applyRegulationMatchResultAndRecompute } = await import(
    "@/lib/admin/regulation-match-result-update"
  );

  const repairedIds: number[] = [];
  let predictionScoresUpdated = 0;

  for (const row of rows) {
    const regulation = countRegulationGoalsFromPartidaPayload(row.provider_payload);
    if (!regulation) continue;
    const curCasa = row.result_casa;
    const curVis = row.result_visitante;
    if (curCasa === regulation.casa && curVis === regulation.visita) continue;

    try {
      const result = await applyRegulationMatchResultAndRecompute({
        matchId: Number(row.match_id),
        resultCasa: regulation.casa,
        resultVisitante: regulation.visita,
      });
      repairedIds.push(Number(row.match_id));
      predictionScoresUpdated += result.predictionsUpdated;
    } catch (err) {
      console.warn(`[regulation-score-repair] partida ${row.match_id}:`, err);
    }
  }

  if (repairedIds.length > 0) {
    try {
      const { mirrorAllSkaleBolaoMatchesFromCopa } = await import(
        "@/lib/football/skale-bolao-sync"
      );
      await mirrorAllSkaleBolaoMatchesFromCopa();
    } catch (err) {
      console.warn("[regulation-score-repair] mirror Skale:", err);
    }
  }

  return {
    candidates: rows.length,
    repaired: repairedIds.length,
    matchIds: repairedIds,
    predictionScoresUpdated,
    ms: Date.now() - t0,
  };
}
