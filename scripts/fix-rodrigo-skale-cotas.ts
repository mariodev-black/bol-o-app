/**
 * Recomputa palpites e pontuação das cotas Skale integral do Rodrigo Getulio.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fix-rodrigo-skale-cotas.ts
 */
import "dotenv/config";
import { getPool } from "../lib/db";
import { calcPredictionPoints } from "../lib/predictions";
import { recomputePredictionScoreForPrediction } from "../lib/predictions/score-recompute";
import { getSkaleBolaoCompetitionId } from "../lib/boloes/skale-config";

const EMAIL = "rodrigo@skalepay.com.br";
const MATCH_ID = 27376;

const COTAS: Array<{ label: string; ticketId: string }> = [
  { label: "Cota 01", ticketId: "feb7c970-f59a-4004-bf5b-f9474642c801" },
  { label: "Cota 02", ticketId: "18e28026-0ced-4640-9c2b-2dabefd92426" },
];

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  const skaleComp = getSkaleBolaoCompetitionId();

  try {
    const userRes = await client.query<{ id: string; name: string | null }>(
      `SELECT id::text AS id, name FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [EMAIL],
    );
    const user = userRes.rows[0];
    if (!user) throw new Error(`Usuário não encontrado: ${EMAIL}`);

    const matchRes = await client.query<{
      home_name: string;
      away_name: string;
      status: string;
      result_casa: number | null;
      result_visitante: number | null;
    }>(
      `SELECT home_name, away_name, status, result_casa, result_visitante
         FROM matches_cache WHERE competition_id = $1 AND match_id = $2`,
      [skaleComp, MATCH_ID],
    );
    const match = matchRes.rows[0];
    if (!match) throw new Error(`Partida ${MATCH_ID} não encontrada`);

    console.log(`Usuário: ${user.name ?? ""} (${EMAIL})`);
    console.log(
      `Partida: ${match.home_name} x ${match.away_name} — ${match.status} ${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}\n`,
    );

    for (const cota of COTAS) {
      const ticketRes = await client.query<{ user_id: string }>(
        `SELECT user_id::text FROM tickets WHERE id::text = $1 AND extra_championship_id = $2`,
        [cota.ticketId, skaleComp],
      );
      if (ticketRes.rows[0]?.user_id !== user.id) {
        throw new Error(`${cota.label}: ticket inválido ou de outro usuário`);
      }

      const predIdsRes = await client.query<{ id: string; match_id: number; score_casa: number; score_visitante: number }>(
        `SELECT id::text AS id, match_id, score_casa, score_visitante
           FROM predictions WHERE ticket_id = $1 ORDER BY match_id`,
        [cota.ticketId],
      );

      await client.query("BEGIN");
      for (const row of predIdsRes.rows) {
        await recomputePredictionScoreForPrediction(client, row.id);
      }
      await client.query("COMMIT");

      const sui = predIdsRes.rows.find((r) => Number(r.match_id) === MATCH_ID);
      const suiPts = sui
        ? calcPredictionPoints(
            sui.score_casa,
            sui.score_visitante,
            match.result_casa as number,
            match.result_visitante as number,
          )
        : null;

      const totals = await pool.query<{ total: number; matches: number }>(
        `SELECT COALESCE(SUM(points), 0)::int AS total, COUNT(*)::int AS matches
           FROM prediction_scores WHERE ticket_id = $1`,
        [cota.ticketId],
      );

      console.log(`--- ${cota.label} (${cota.ticketId}) ---`);
      if (sui) {
        console.log(
          `Suíça x Bósnia: palpite ${sui.score_casa}x${sui.score_visitante} → ${suiPts?.points ?? 0} pts`,
        );
      }
      console.log(
        `${predIdsRes.rows.length} palpites recomputados → total ${totals.rows[0]?.total ?? 0} pts (${totals.rows[0]?.matches ?? 0} jogos)\n`,
      );
    }

    console.log("Concluído.");
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
