/**
 * Insere/atualiza palpite Noruega 2 x 1 Senegal e recomputa pontuação do ticket.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fix-ticket-nor-sen-palpite.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fix-ticket-nor-sen-palpite.ts <ticketId> [casa] [visitante]
 */
import "dotenv/config";
import { getPool } from "../lib/db";
import { calcPredictionPoints } from "../lib/predictions";
import { recomputePredictionScoreForPrediction } from "../lib/predictions/score-recompute";
import { getFootballMainCompetitionId } from "../lib/boloes-extra-config";

const DEFAULT_TICKET_ID = "10a88d6b-76b8-4843-b46b-d12391332350";
const DEFAULT_SCORE_CASA = 2;
const DEFAULT_SCORE_VISITANTE = 1;

async function resolveMatchId(
  pool: ReturnType<typeof getPool>,
  compId: number,
): Promise<number> {
  const { rows } = await pool.query<{ match_id: number; home_name: string; away_name: string }>(
    `SELECT match_id, home_name, away_name FROM matches_cache
     WHERE competition_id = $1
       AND (
         (home_name ILIKE '%noru%' AND away_name ILIKE '%sene%')
         OR (home_name ILIKE '%norw%' AND away_name ILIKE '%sene%')
         OR (home_name ILIKE '%sene%' AND away_name ILIKE '%noru%')
         OR (home_name ILIKE '%sene%' AND away_name ILIKE '%norw%')
       )
     ORDER BY kickoff_at ASC NULLS LAST
     LIMIT 5`,
    [compId],
  );
  if (rows.length === 0) {
    throw new Error(`Partida Noruega x Senegal não encontrada (comp ${compId})`);
  }
  const norHome = rows.find(
    (r) =>
      /noru|norw/i.test(r.home_name) && /sene/i.test(r.away_name),
  );
  const pick = norHome ?? rows[0]!;
  console.log(`Match escolhido: ${pick.home_name} x ${pick.away_name} (#${pick.match_id})`);
  return Number(pick.match_id);
}

async function main() {
  const ticketId = process.argv[2]?.trim() || DEFAULT_TICKET_ID;
  const scoreCasa = process.argv[3] != null ? Number(process.argv[3]) : DEFAULT_SCORE_CASA;
  const scoreVisitante =
    process.argv[4] != null ? Number(process.argv[4]) : DEFAULT_SCORE_VISITANTE;

  if (!Number.isFinite(scoreCasa) || !Number.isFinite(scoreVisitante)) {
    console.error(
      "Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/fix-ticket-nor-sen-palpite.ts [ticketId] [casa] [visitante]",
    );
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();
  const mainCompId = getFootballMainCompetitionId();

  try {
    const ticketRes = await client.query<{
      id: string;
      user_id: string;
      ticket_type: string;
      status: string;
      extra_championship_id: number | null;
      bolao_type: string;
      email: string;
      name: string | null;
    }>(
      `SELECT t.id::text, t.user_id::text, t.ticket_type, t.status, t.extra_championship_id,
              u.email, u.name,
              CASE WHEN t.ticket_type = 'extra' THEN 'extra' ELSE 'principal' END AS bolao_type
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.id::text = $1
       LIMIT 1`,
      [ticketId],
    );
    const ticket = ticketRes.rows[0];
    if (!ticket) throw new Error(`Ticket não encontrado: ${ticketId}`);

    const compId =
      ticket.ticket_type === "extra" && ticket.extra_championship_id != null
        ? ticket.extra_championship_id
        : mainCompId;

    const matchId = await resolveMatchId(pool, compId);

    const matchRes = await client.query<{
      home_name: string;
      away_name: string;
      status: string;
      result_casa: number | null;
      result_visitante: number | null;
    }>(
      `SELECT home_name, away_name, status, result_casa, result_visitante
       FROM matches_cache WHERE competition_id = $1 AND match_id = $2`,
      [compId, matchId],
    );
    const match = matchRes.rows[0];
    if (!match) throw new Error(`Match ${matchId} não encontrado`);

    const norIsHome = /noru|norw/i.test(match.home_name);
    const palpiteCasa = norIsHome ? scoreCasa : scoreVisitante;
    const palpiteVisitante = norIsHome ? scoreVisitante : scoreCasa;

    console.log(`Usuário: ${ticket.name ?? ""} (${ticket.email})`);
    console.log(`Ticket: ${ticketId} (${ticket.status}, ${ticket.ticket_type})`);
    console.log(
      `Partida: ${match.home_name} x ${match.away_name} (#${matchId}) — ${match.status} ${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}`,
    );
    console.log(
      `Palpite a gravar (casa x visitante): ${palpiteCasa}x${palpiteVisitante} (Noruega ${scoreCasa} x ${scoreVisitante} Senegal)`,
    );

    const existing = await client.query<{ id: string; score_casa: number; score_visitante: number }>(
      `SELECT id::text AS id, score_casa, score_visitante FROM predictions
       WHERE ticket_id = $1 AND match_id = $2 LIMIT 1`,
      [ticketId, matchId],
    );
    if (existing.rows[0]) {
      console.log(
        `Palpite existente ${existing.rows[0].id}: ${existing.rows[0].score_casa}x${existing.rows[0].score_visitante} — atualizando...`,
      );
    }

    await client.query("BEGIN");

    const { rows: predRows } = await client.query<{ id: string }>(
      `INSERT INTO predictions (user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, ticket_id, match_id)
       DO UPDATE SET score_casa = EXCLUDED.score_casa,
                     score_visitante = EXCLUDED.score_visitante,
                     updated_at = now()
       RETURNING id::text AS id`,
      [
        ticket.user_id,
        ticketId,
        ticket.bolao_type,
        matchId,
        palpiteCasa,
        palpiteVisitante,
      ],
    );
    const predId = predRows[0]!.id;

    await recomputePredictionScoreForPrediction(client, predId);
    await client.query("COMMIT");

    const hasResult =
      match.result_casa != null && match.result_visitante != null;
    const calc = hasResult
      ? calcPredictionPoints(
          palpiteCasa,
          palpiteVisitante,
          match.result_casa as number,
          match.result_visitante as number,
        )
      : { points: 0 };

    const scoreRow = await pool.query<{
      points: number;
      exact: boolean;
      outcome_hit: boolean;
    }>(
      `SELECT points, exact, outcome_hit FROM prediction_scores WHERE prediction_id = $1`,
      [predId],
    );

    const totals = await pool.query<{ total: number; matches: number }>(
      `SELECT COALESCE(SUM(points), 0)::int AS total, COUNT(*)::int AS matches
       FROM prediction_scores WHERE ticket_id = $1`,
      [ticketId],
    );

    console.log(`\nPalpite gravado: ${palpiteCasa}x${palpiteVisitante} (prediction_id=${predId})`);
    console.log(
      `Pontos nesta partida: ${scoreRow.rows[0]?.points ?? calc.points} (exact=${scoreRow.rows[0]?.exact ?? false})`,
    );
    if (hasResult) {
      console.log(`Resultado real: ${match.result_casa}x${match.result_visitante}`);
    }
    console.log(
      `Total ticket: ${totals.rows[0]?.total ?? 0} pts em ${totals.rows[0]?.matches ?? 0} jogos pontuados`,
    );
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
