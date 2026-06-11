/**
 * Sincroniza resultados da Série B e recomputa prediction_scores.
 *
 * Uso: npx tsx scripts/recompute-serie-b-scores.ts [rodada]
 * Default rodada: 12
 */
import "dotenv/config";
import { getPool } from "@/lib/db";
import { syncExtra } from "@/lib/football/sync-orchestrator";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

const COMP = Number(process.env.SERIE_B_EXTRA_CHAMPIONSHIP_ID || "14") || 14;
const RODADA = Math.max(1, Number.parseInt(process.argv[2] ?? "12", 10) || 12);

async function main() {
  console.log(`[serie-b] sync comp=${COMP} rodada=${RODADA}...`);
  const sync = await syncExtra(COMP, { extraRodadas: [RODADA] });
  console.log("[serie-b] sync:", {
    matches: sync.matchesPersisted,
    rodadas: sync.rodadasCarregadas,
    ms: sync.ms,
    skipped: sync.skippedReason,
  });

  const pool = getPool();
  const { rows } = await pool.query<{ match_id: string }>(
    `SELECT match_id::text FROM matches_cache
     WHERE competition_id = $1 AND rodada = $2`,
    [COMP, RODADA],
  );
  const matchIds = rows.map((r) => Number(r.match_id)).filter((n) => Number.isFinite(n) && n > 0);
  console.log(`[serie-b] recomputando ${matchIds.length} partidas...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { updated } = await recomputePredictionScoresForMatches(client, matchIds);
    await client.query("COMMIT");
    console.log(`[serie-b] prediction_scores atualizados: ${updated}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const totals = await pool.query<{ preds: number; pts: number }>(
    `SELECT count(ps.prediction_id)::int AS preds, coalesce(sum(ps.points),0)::int AS pts
     FROM prediction_scores ps
     JOIN tickets t ON t.id::text = ps.ticket_id
     WHERE t.extra_championship_id = $1 AND t.round_number = $2`,
    [COMP, RODADA],
  );
  console.log("[serie-b] totais rodada:", totals.rows[0]);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
