import "dotenv/config";
import { getPool } from "@/lib/db";
import { calcPredictionPoints } from "@/lib/predictions";

async function main() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.score_casa, p.score_visitante, ps.points, u.email, t.extra_championship_id
     FROM predictions p
     JOIN prediction_scores ps ON ps.prediction_id = p.id
     JOIN users u ON u.id = p.user_id
     JOIN tickets t ON t.id::text = p.ticket_id::text
     WHERE p.match_id = 32338 AND p.score_casa = 1 AND p.score_visitante = 1
     ORDER BY t.extra_championship_id NULLS FIRST, u.email
     LIMIT 30`,
  );
  console.log("1x1 palpites após correção:", rows.length);
  for (const r of rows) {
    const exp = calcPredictionPoints(1, 1, 2, 2);
    console.log({
      email: r.email,
      skale: r.extra_championship_id,
      points: r.points,
      expected: exp.points,
      ok: r.points === exp.points,
    });
  }

  const skale = await pool.query(
    `SELECT u.email, ps.points, p.score_casa, p.score_visitante
     FROM predictions p
     JOIN prediction_scores ps ON ps.prediction_id = p.id
     JOIN users u ON u.id = p.user_id
     JOIN tickets t ON t.id::text = p.ticket_id::text
     WHERE p.match_id = 32338 AND t.extra_championship_id = 90007
     ORDER BY ps.points DESC, u.email`,
  );
  console.log("\nSkale bolão (90007) —", skale.rows.length, "palpites");
  for (const r of skale.rows) console.log(r);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
