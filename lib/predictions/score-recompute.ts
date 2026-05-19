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

type PredictionForRecompute = {
  prediction_id: string;
  user_id: string;
  ticket_id: string;
  bolao_type: string;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  match_status: string | null;
  result_casa: number | null;
  result_visitante: number | null;
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

  const { rows } = await client.query<PredictionForRecompute>(
    `SELECT
       p.id::text                AS prediction_id,
       p.user_id::text           AS user_id,
       p.ticket_id::text         AS ticket_id,
       p.bolao_type              AS bolao_type,
       p.match_id                AS match_id,
       p.score_casa              AS score_casa,
       p.score_visitante         AS score_visitante,
       lower(coalesce(mc.status,'')) AS match_status,
       mc.result_casa            AS result_casa,
       mc.result_visitante       AS result_visitante
     FROM predictions p
     LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
     WHERE p.match_id = ANY($1::bigint[])`,
    [uniqueIds],
  );

  if (rows.length === 0) return { updated: 0, matchesTouched: [] };

  // Se ainda não temos placar oficial, score = 0 (palpite não pontua).
  // Quando o placar vier, o próximo tick do worker dispara novo recompute.
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  const touched = new Set<number>();
  for (const row of rows) {
    const hasResult = row.result_casa != null && row.result_visitante != null;
    const calc = hasResult
      ? calcPredictionPoints(row.score_casa, row.score_visitante, row.result_casa as number, row.result_visitante as number)
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
      row.match_status,
      row.result_casa,
      row.result_visitante,
    );
    touched.add(Number(row.match_id));
  }

  await client.query(RECOMPUTE_UPSERT_SQL.replace("%VALUES%", values.join(", ")), params);

  return { updated: rows.length, matchesTouched: [...touched] };
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
