import "dotenv/config";
import { getPool } from "@/lib/db";

const COMP = 14;
const pool = getPool();

async function main() {
  console.log("connecting...");
  const mc = await pool.query(
    `SELECT rodada, status, count(*)::int as n,
            count(*) FILTER (WHERE result_casa IS NOT NULL AND result_visitante IS NOT NULL)::int as with_results
     FROM matches_cache WHERE competition_id = $1
     GROUP BY rodada, status ORDER BY rodada DESC NULLS LAST LIMIT 20`,
    [COMP],
  );
  console.log("=== matches_cache ===");
  console.table(mc.rows);

  const preds = await pool.query(
    `SELECT t.round_number, count(p.id)::int as preds,
            count(ps.prediction_id)::int as scored,
            sum(coalesce(ps.points,0))::int as total_pts,
            count(*) FILTER (WHERE ps.points IS NULL OR ps.points = 0)::int as zero_pts
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE t.extra_championship_id = $1 AND t.status = 'paid'
     GROUP BY t.round_number ORDER BY t.round_number`,
    [COMP],
  );
  console.log("=== predictions by round ===");
  console.table(preds.rows);

  const gap = await pool.query(
    `SELECT count(*)::int as n
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     INNER JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $1
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE t.extra_championship_id = $1 AND t.status = 'paid'
       AND mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL
       AND (ps.points IS NULL OR ps.points = 0)`,
    [COMP],
  );
  console.log("preds with results but 0/null points:", gap.rows[0]?.n);

  const noResult = await pool.query(
    `SELECT count(*)::int as n
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     LEFT JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $1
     WHERE t.extra_championship_id = $1 AND t.status = 'paid'
       AND (mc.result_casa IS NULL OR mc.result_visitante IS NULL)`,
    [COMP],
  );
  console.log("preds missing match results in cache:", noResult.rows[0]?.n);

  const computed = await pool.query(
    `SELECT min(ps.computed_at)::text AS min_at, max(ps.computed_at)::text AS max_at,
            count(*) FILTER (WHERE ps.last_result_casa IS NULL)::int AS null_results
     FROM prediction_scores ps
     JOIN tickets t ON t.id::text = ps.ticket_id
     WHERE t.extra_championship_id = $1 AND t.round_number = 12`,
    [COMP],
  );
  console.log("computed_at / null last_result:", computed.rows[0]);

  const synced = await pool.query(
    `SELECT min(synced_at)::text AS min_sync, max(synced_at)::text AS max_sync
     FROM matches_cache WHERE competition_id = $1 AND rodada = 12`,
    [COMP],
  );
  console.log("matches_cache synced_at r12:", synced.rows[0]);

  const roundDist = await pool.query(
    `SELECT round_number, count(*)::int AS n
     FROM tickets WHERE extra_championship_id = $1 AND status = 'paid'
     GROUP BY round_number ORDER BY round_number`,
    [COMP],
  );
  console.log("ticket round_number:", roundDist.rows);

  const predRodada = await pool.query(
    `SELECT mc.rodada, count(*)::int AS preds
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $1
     WHERE t.extra_championship_id = $1 AND t.status = 'paid'
     GROUP BY mc.rodada ORDER BY mc.rodada`,
    [COMP],
  );
  console.log("predictions by match rodada:", predRodada.rows);

  const mismatch = await pool.query(
    `SELECT count(*)::int AS n
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $1
     WHERE t.extra_championship_id = $1 AND t.status = 'paid'
       AND t.round_number = 13 AND mc.rodada = 12`,
    [COMP],
  );
  console.log("tickets r13 with preds on r12 matches:", mismatch.rows[0]?.n);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
