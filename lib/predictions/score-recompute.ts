/**
 * Pontuação ao vivo (v2.1) — recálculo materializado por palpite.
 *
 * Chamado pela cascata em `lib/football/persistence.ts` toda vez que uma partida
 * tem `scoredChanged=true` (placar / status / penaltis mudaram).
 *
 * Para cada `match_id` afetado, faz:
 *   1) Encontra todos os palpites daquela partida (`predictions`).
 *   2) Lê o placar atual da partida (`matches_cache`).
 *   3) Aplica `calcPredictionPoints(palpite, real)`.
 *   4) UPSERT em `prediction_scores`.
 *
 * Pontos PODEM DIMINUIR: se o placar muda (ex.: 1x1 → 2x1) e o palpite passa
 * a valer menos, o UPSERT sobrescreve com o valor novo. Quem agrega por ticket
 * recebe a soma correta no próximo SELECT.
 *
 * Idempotência: rerodar com o mesmo placar produz exatamente as mesmas linhas.
 */

import type { PoolClient } from "pg";
import { calcPredictionPoints } from "@/lib/predictions";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { skaleMirrorCompetitionIdsSqlList } from "@/lib/boloes/match-cache-competition-id";
import { getSkaleBolaoSourceCopaCompetitionId } from "@/lib/boloes/skale-config";
import {
  getWeekendBolaoCompetitionId,
  getWeekendBolaoSourceCopaCompetitionId,
} from "@/lib/boloes/weekend-bolao-config";
import type { CachedMatchRow } from "@/lib/matches-cache";
import {
  resolveMatchScoresFromCacheRow,
  resolveMatchStatusFromCacheRow,
} from "@/lib/match-cache-display";

type PredictionForRecompute = {
  prediction_id: string;
  user_id: string;
  ticket_id: string;
  bolao_type: string;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  match_status_raw: string | null;
  result_casa: number | null;
  result_visitante: number | null;
  kickoff_at: string | null;
  provider_payload: Record<string, unknown> | null;
};

const RECOMPUTE_UPSERT_SQL = `
INSERT INTO prediction_scores (
  prediction_id, ticket_id, user_id, match_id, bolao_type,
  points, exact, outcome_hit, goals_hit_count,
  last_match_status, last_result_casa, last_result_visitante, computed_at
) VALUES %VALUES%
ON CONFLICT (prediction_id) DO UPDATE SET
  ticket_id              = EXCLUDED.ticket_id,
  user_id                = EXCLUDED.user_id,
  match_id               = EXCLUDED.match_id,
  bolao_type             = EXCLUDED.bolao_type,
  points                 = EXCLUDED.points,
  exact                  = EXCLUDED.exact,
  outcome_hit            = EXCLUDED.outcome_hit,
  goals_hit_count        = EXCLUDED.goals_hit_count,
  last_match_status      = EXCLUDED.last_match_status,
  last_result_casa       = EXCLUDED.last_result_casa,
  last_result_visitante  = EXCLUDED.last_result_visitante,
  computed_at            = now()
`;

const COLS_PER_ROW = 12;

function hasMatchCacheSnapshot(row: PredictionForRecompute): boolean {
  return (
    row.match_status_raw != null ||
    row.result_casa != null ||
    row.result_visitante != null ||
    row.kickoff_at != null ||
    (row.provider_payload != null && Object.keys(row.provider_payload).length > 0)
  );
}

/**
 * Recomputa `prediction_scores` para os `match_id` informados. Usa o `client`
 * recebido (mesma transação do caller — atomicidade).
 *
 * Retorna o número de linhas (palpites) atualizadas.
 */
export async function recomputePredictionScoresForMatches(
  client: PoolClient,
  matchIds: number[],
): Promise<{ updated: number; matchesTouched: number[] }> {
  if (matchIds.length === 0) return { updated: 0, matchesTouched: [] };
  const uniqueIds = [...new Set(matchIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (uniqueIds.length === 0) return { updated: 0, matchesTouched: [] };

  const mainComp = getFootballMainCompetitionId();
  const copaSource = getSkaleBolaoSourceCopaCompetitionId();
  const skaleMirrorIds = skaleMirrorCompetitionIdsSqlList();
  const weekendId = getWeekendBolaoCompetitionId();
  const weekendSource = getWeekendBolaoSourceCopaCompetitionId();

  const { rows } = await client.query<PredictionForRecompute>(
    `SELECT
       p.id::text                AS prediction_id,
       p.user_id::text           AS user_id,
       p.ticket_id::text         AS ticket_id,
       p.bolao_type              AS bolao_type,
       p.match_id                AS match_id,
       p.score_casa              AS score_casa,
       p.score_visitante         AS score_visitante,
       COALESCE(mc_src.status, mc_fb.status) AS match_status_raw,
       COALESCE(mc_src.result_casa, mc_fb.result_casa) AS result_casa,
       COALESCE(mc_src.result_visitante, mc_fb.result_visitante) AS result_visitante,
       COALESCE(mc_src.kickoff_at, mc_fb.kickoff_at)::text AS kickoff_at,
       COALESCE(mc_src.provider_payload, mc_fb.provider_payload) AS provider_payload
     FROM predictions p
     LEFT JOIN tickets t ON t.id::text = p.ticket_id::text
     LEFT JOIN matches_cache mc_src ON mc_src.match_id = p.match_id
       AND mc_src.competition_id = CASE
         WHEN p.bolao_type = 'extra'
           AND t.extra_championship_id = ANY($3::int[])
           THEN $4::int
         WHEN p.bolao_type = 'extra'
           AND t.extra_championship_id = $5::int
           THEN $6::int
         WHEN p.bolao_type = 'extra' THEN t.extra_championship_id
         ELSE $2::int
       END
     LEFT JOIN matches_cache mc_fb ON mc_fb.match_id = p.match_id
       AND p.bolao_type = 'extra'
       AND (
         t.extra_championship_id = ANY($3::int[])
         OR t.extra_championship_id = $5::int
       )
       AND mc_fb.competition_id = t.extra_championship_id
     WHERE p.match_id = ANY($1::bigint[])`,
    [uniqueIds, mainComp, skaleMirrorIds, copaSource, weekendId, weekendSource],
  );

  if (rows.length === 0) return { updated: 0, matchesTouched: [] };

  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  const touched = new Set<number>();
  let updated = 0;

  for (const row of rows) {
    if (!hasMatchCacheSnapshot(row)) continue;

    const cacheRow = {
      status: row.match_status_raw ?? "",
      result_casa: row.result_casa,
      result_visitante: row.result_visitante,
      kickoff_at: row.kickoff_at,
      provider_payload: row.provider_payload,
    } as CachedMatchRow;
    const status = resolveMatchStatusFromCacheRow(cacheRow);
    const { resultCasa, resultVisitante } = resolveMatchScoresFromCacheRow(cacheRow);
    const hasResult = resultCasa != null && resultVisitante != null;
    const calc = hasResult
      ? calcPredictionPoints(row.score_casa, row.score_visitante, resultCasa, resultVisitante)
      : { points: 0, exact: false, outcomeHit: false, goalsHitCount: 0 };

    const placeholders: string[] = [];
    for (let i = 0; i < COLS_PER_ROW; i++) placeholders.push(`$${p++}`);
    values.push(`(${placeholders.join(", ")}, now())`);
    params.push(
      row.prediction_id,
      row.ticket_id,
      row.user_id,
      row.match_id,
      row.bolao_type,
      calc.points,
      calc.exact,
      calc.outcomeHit,
      calc.goalsHitCount,
      status,
      hasResult ? resultCasa : null,
      hasResult ? resultVisitante : null,
    );
    touched.add(Number(row.match_id));
    updated += 1;
  }

  if (values.length === 0) return { updated: 0, matchesTouched: [] };

  await client.query(RECOMPUTE_UPSERT_SQL.replace("%VALUES%", values.join(", ")), params);

  return { updated, matchesTouched: [...touched] };
}

/**
 * Recompute "preguiçoso" — útil quando um palpite é criado/editado pela primeira
 * vez e o jogo já tem placar (raro, mas cobre `POST /api/palpites` em jogos vivos
 * ou casos manuais).
 */
export async function recomputePredictionScoreForPrediction(
  client: PoolClient,
  predictionId: string,
): Promise<void> {
  const { rows } = await client.query<{ match_id: number }>(
    `SELECT match_id FROM predictions WHERE id = $1::uuid`,
    [predictionId],
  );
  const matchId = rows[0]?.match_id;
  if (matchId == null) return;
  await recomputePredictionScoresForMatches(client, [Number(matchId)]);
}
