/**
 * Insere palpite manual ARA 1 x 2 URU (2x1 uruguaio) e recomputa pontos.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fix-ara-uru-palpite-ticket.ts <ticket-id>
 */
import "dotenv/config";
import { getPool } from "../lib/db";
import { calcPredictionPoints } from "../lib/predictions";
import { recomputePredictionScoreForPrediction } from "../lib/predictions/score-recompute";
import { getFootballMainCompetitionId } from "../lib/boloes-extra-config";

const TICKET_ID = process.argv[2]?.trim();
/** Palpite: 2x1 uruguaio → Arábia 1, Uruguai 2 */
const SCORE_CASA = 1;
const SCORE_VISITANTE = 2;
const MATCH_ID = 27411; // Arábia Saudita x Uruguai

async function main() {
  if (!TICKET_ID) {
    console.error("Uso: npx tsx ... scripts/fix-ara-uru-palpite-ticket.ts <ticket-id>");
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();
  const compId = getFootballMainCompetitionId();

  try {
    const ticketRes = await client.query<{
      id: string;
      user_id: string;
      ticket_type: string;
      status: string;
      bolao_type: string;
      email: string;
      name: string | null;
      extra_championship_id: number | null;
    }>(
      `SELECT t.id::text, t.user_id::text, t.ticket_type, t.status, t.extra_championship_id,
              u.email, u.name,
              CASE WHEN t.ticket_type = 'extra' THEN 'extra' ELSE 'principal' END AS bolao_type
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.id::text = $1 LIMIT 1`,
      [TICKET_ID],
    );
    const ticket = ticketRes.rows[0];
    if (!ticket) throw new Error(`Ticket não encontrado: ${TICKET_ID}`);

    const matchCompId = ticket.extra_championship_id ?? compId;

    const matchRes = await client.query<{
      home_name: string;
      away_name: string;
      status: string;
      result_casa: number | null;
      result_visitante: number | null;
    }>(
      `SELECT home_name, away_name, status, result_casa, result_visitante
       FROM matches_cache WHERE competition_id = $1 AND match_id = $2`,
      [matchCompId, MATCH_ID],
    );
    const match = matchRes.rows[0];
    if (!match) {
      throw new Error(`Match ${MATCH_ID} não encontrado (comp ${matchCompId})`);
    }

    console.log(`Usuário: ${ticket.name ?? ""} (${ticket.email})`);
    console.log(`Ticket: ${TICKET_ID} (${ticket.status}, ${ticket.ticket_type})`);
    console.log(
      `Partida: ${match.home_name} x ${match.away_name} (#${MATCH_ID}) — ${match.status} ${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}`,
    );

    const existing = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM predictions
       WHERE ticket_id = $1 AND match_id = $2 LIMIT 1`,
      [TICKET_ID, MATCH_ID],
    );
    if (existing.rows[0]) {
      console.log(`Palpite existente ${existing.rows[0].id} — atualizando...`);
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
        TICKET_ID,
        ticket.bolao_type,
        MATCH_ID,
        SCORE_CASA,
        SCORE_VISITANTE,
      ],
    );
    const predId = predRows[0]!.id;

    await recomputePredictionScoreForPrediction(client, predId);

    await client.query("COMMIT");

    const hasResult =
      match.result_casa != null && match.result_visitante != null;
    const calc = hasResult
      ? calcPredictionPoints(
          SCORE_CASA,
          SCORE_VISITANTE,
          match.result_casa as number,
          match.result_visitante as number,
        )
      : { points: 0, exact: false, outcomeHit: false, goalsHitCount: 0 };

    const totals = await pool.query<{ total: number; matches: number }>(
      `SELECT COALESCE(SUM(points), 0)::int AS total, COUNT(*)::int AS matches
       FROM prediction_scores WHERE ticket_id = $1`,
      [TICKET_ID],
    );

    console.log(`\nPalpite gravado: ${SCORE_CASA}x${SCORE_VISITANTE} (prediction_id=${predId})`);
    console.log(
      `Pontos nesta partida: ${calc.points} (resultado real ${match.result_casa}x${match.result_visitante})`,
    );
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
