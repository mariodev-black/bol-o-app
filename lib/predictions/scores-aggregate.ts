/**
 * Agregação de `prediction_scores` — leitura barata para UI e ranking ao vivo.
 *
 * Estas funções **não** chamam a API Futebol e **não** invocam
 * `calcPredictionPoints` — confiam no cache materializado escrito pelo
 * `lib/predictions/score-recompute.ts` (acionado pela cascata de partidas).
 */

import { getPool } from "@/lib/db";

export type TicketLiveTotals = {
  ticketId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  predictionsScored: number; // palpites já com placar oficial
};

export async function getTicketLiveTotals(ticketId: string): Promise<TicketLiveTotals> {
  const pool = getPool();
  const { rows } = await pool.query<{
    total_points: string;
    exact_count: string;
    outcome_count: string;
    goals_count: string;
    scored: string;
  }>(
    `SELECT
       COALESCE(SUM(points), 0)::text                                AS total_points,
       COALESCE(SUM(CASE WHEN exact THEN 1 ELSE 0 END), 0)::text     AS exact_count,
       COALESCE(SUM(CASE WHEN outcome_hit THEN 1 ELSE 0 END), 0)::text AS outcome_count,
       COALESCE(SUM(goals_hit_count), 0)::text                       AS goals_count,
       COUNT(*) FILTER (WHERE last_result_casa IS NOT NULL)::text    AS scored
     FROM prediction_scores
     WHERE ticket_id = $1`,
    [ticketId],
  );
  const r = rows[0];
  return {
    ticketId,
    totalPoints: Number(r?.total_points ?? 0),
    exactCount: Number(r?.exact_count ?? 0),
    outcomeCount: Number(r?.outcome_count ?? 0),
    goalsCount: Number(r?.goals_count ?? 0),
    predictionsScored: Number(r?.scored ?? 0),
  };
}

export async function getTicketsLiveTotalsBatch(
  ticketIds: string[],
): Promise<Map<string, TicketLiveTotals>> {
  const out = new Map<string, TicketLiveTotals>();
  const ids = [...new Set(ticketIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const pool = getPool();
  const { rows } = await pool.query<{
    ticket_id: string;
    total_points: string;
    exact_count: string;
    outcome_count: string;
    goals_count: string;
    scored: string;
  }>(
    `SELECT
       ticket_id,
       COALESCE(SUM(points), 0)::text                                AS total_points,
       COALESCE(SUM(CASE WHEN exact THEN 1 ELSE 0 END), 0)::text     AS exact_count,
       COALESCE(SUM(CASE WHEN outcome_hit THEN 1 ELSE 0 END), 0)::text AS outcome_count,
       COALESCE(SUM(goals_hit_count), 0)::text                       AS goals_count,
       COUNT(*) FILTER (WHERE last_result_casa IS NOT NULL)::text    AS scored
     FROM prediction_scores
     WHERE ticket_id = ANY($1::text[])
     GROUP BY ticket_id`,
    [ids],
  );
  for (const r of rows) {
    out.set(r.ticket_id, {
      ticketId: r.ticket_id,
      totalPoints: Number(r.total_points || 0),
      exactCount: Number(r.exact_count || 0),
      outcomeCount: Number(r.outcome_count || 0),
      goalsCount: Number(r.goals_count || 0),
      predictionsScored: Number(r.scored || 0),
    });
  }
  for (const id of ids) {
    if (!out.has(id)) {
      out.set(id, {
        ticketId: id,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        predictionsScored: 0,
      });
    }
  }
  return out;
}

/**
 * Top do ranking ao vivo para um bolão (principal, diario, extra). Usa apenas
 * `prediction_scores`. Não desempata por `firstSubmitAt` aqui — para o desempate
 * fino, consultar o caller (que tem acesso a `predictions.submitted_at`).
 */
export async function getLiveRankingTopByBolao(
  bolaoType: "principal" | "diario" | "extra",
  opts?: { limit?: number },
): Promise<Array<TicketLiveTotals>> {
  const pool = getPool();
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const { rows } = await pool.query<{
    ticket_id: string;
    total_points: string;
    exact_count: string;
    outcome_count: string;
    goals_count: string;
    scored: string;
  }>(
    `SELECT
       ticket_id,
       COALESCE(SUM(points), 0)::int                                AS total_points,
       COALESCE(SUM(CASE WHEN exact THEN 1 ELSE 0 END), 0)::int     AS exact_count,
       COALESCE(SUM(CASE WHEN outcome_hit THEN 1 ELSE 0 END), 0)::int AS outcome_count,
       COALESCE(SUM(goals_hit_count), 0)::int                       AS goals_count,
       COUNT(*) FILTER (WHERE last_result_casa IS NOT NULL)::int    AS scored
     FROM prediction_scores
     WHERE bolao_type = $1
     GROUP BY ticket_id
     ORDER BY
       total_points DESC,
       exact_count DESC,
       outcome_count DESC,
       goals_count DESC
     LIMIT $2`,
    [bolaoType, limit],
  );
  return rows.map((r) => ({
    ticketId: r.ticket_id,
    totalPoints: Number(r.total_points || 0),
    exactCount: Number(r.exact_count || 0),
    outcomeCount: Number(r.outcome_count || 0),
    goalsCount: Number(r.goals_count || 0),
    predictionsScored: Number(r.scored || 0),
  }));
}
