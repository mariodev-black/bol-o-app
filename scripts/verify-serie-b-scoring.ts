import "dotenv/config";
import { getPool } from "@/lib/db";
import { calcPredictionPoints } from "@/lib/predictions/calc-points";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";

const COMP = 14;
const pool = getPool();
const mainComp = getFootballMainCompetitionId();

async function main() {
  const { rows } = await pool.query<{
    prediction_id: string;
    match_id: string;
    score_casa: number;
    score_visitante: number;
    ps_points: number;
    mc14_casa: number | null;
    mc14_vis: number | null;
    mc14_status: string | null;
    mc_wrong_casa: number | null;
    mc_wrong_vis: number | null;
    mc_wrong_comp: number | null;
  }>(
    `SELECT
       p.id::text AS prediction_id,
       p.match_id::text AS match_id,
       p.score_casa,
       p.score_visitante,
       coalesce(ps.points, -1) AS ps_points,
       mc14.result_casa AS mc14_casa,
       mc14.result_visitante AS mc14_vis,
       mc14.status AS mc14_status,
       mc_wrong.result_casa AS mc_wrong_casa,
       mc_wrong.result_visitante AS mc_wrong_vis,
       mc_wrong.competition_id AS mc_wrong_comp
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     LEFT JOIN matches_cache mc14 ON mc14.match_id = p.match_id AND mc14.competition_id = $1
     LEFT JOIN matches_cache mc_wrong ON mc_wrong.match_id = p.match_id
       AND mc_wrong.competition_id <> $1
     WHERE t.extra_championship_id = $1 AND t.status = 'paid' AND t.round_number = 12
     LIMIT 500`,
    [COMP],
  );

  let mismatch = 0;
  let wrongJoinAffected = 0;
  const samples: unknown[] = [];

  for (const row of rows) {
    const expected =
      row.mc14_casa != null && row.mc14_vis != null
        ? calcPredictionPoints(
            row.score_casa,
            row.score_visitante,
            row.mc14_casa,
            row.mc14_vis,
          ).points
        : 0;

    if (expected !== row.ps_points) {
      mismatch++;
      if (samples.length < 8) samples.push({ ...row, expected });
    }
    if (row.mc_wrong_comp != null) wrongJoinAffected++;
  }

  console.log("sampled:", rows.length);
  console.log("mismatch expected vs ps:", mismatch);
  console.log("rows with another comp on same match_id:", wrongJoinAffected);
  if (samples.length) {
    console.log("mismatch samples:");
    console.table(samples);
  }

  // What join-only-on-match_id would pick (arbitrary first row)
  const joinTest = await pool.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (
              WHERE mc.result_casa IS DISTINCT FROM mc14.result_casa
                 OR mc.result_visitante IS DISTINCT FROM mc14.result_visitante
            )::int AS wrong_placar
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
     LEFT JOIN matches_cache mc14 ON mc14.match_id = p.match_id AND mc14.competition_id = $1
     WHERE t.extra_championship_id = $1 AND t.round_number = 12`,
    [COMP],
  );
  console.log("join match_id only vs comp14 placar diff:", joinTest.rows[0]);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
