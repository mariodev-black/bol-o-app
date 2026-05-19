/**
 * Backfill de `prediction_scores` — calcula a pontuação ao vivo para todas as
 * partidas que JÁ tem placar em matches_cache.
 *
 * Idempotente: pode rodar quantas vezes quiser, sempre converge para o estado
 * atual do DB. Em produção, rodar UMA VEZ depois da migration de pontuação ao
 * vivo (scripts/sql/20260520-prediction-scores-live.sql).
 *
 * Uso:
 *   npm run backfill:prediction-scores
 *   ou: tsx --tsconfig tsconfig.scripts.json scripts/backfill-prediction-scores.ts
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { getPool, ensureDatabasePoolReady } from "@/lib/db";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

const BATCH = 200;

async function main() {
  const t0 = Date.now();
  console.log("[backfill] iniciando…");
  await ensureDatabasePoolReady();
  const pool = getPool();

  // Pegamos só os match_ids que tem palpites + placar conhecido.
  const { rows } = await pool.query<{ match_id: string }>(
    `SELECT DISTINCT p.match_id::text AS match_id
       FROM predictions p
       JOIN matches_cache mc ON mc.match_id = p.match_id
      WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL`,
  );
  const matchIds = rows.map((r) => Number(r.match_id)).filter((n) => Number.isFinite(n) && n > 0);
  console.log(`[backfill] ${matchIds.length} partidas com placar + palpites encontradas`);
  if (matchIds.length === 0) {
    console.log("[backfill] nada a fazer");
    await pool.end().catch(() => {});
    return;
  }

  let totalUpdated = 0;
  for (let off = 0; off < matchIds.length; off += BATCH) {
    const batch = matchIds.slice(off, off + BATCH);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await recomputePredictionScoresForMatches(client, batch);
      await client.query("COMMIT");
      totalUpdated += r.updated;
      console.log(`[backfill] batch ${off + 1}-${off + batch.length}: +${r.updated} linhas (acc=${totalUpdated})`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[backfill] erro no batch ${off}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Estatísticas finais
  const stats = await pool.query<{ n: string; tot: string; ex: string }>(
    `SELECT count(*)::text AS n,
            COALESCE(SUM(points),0)::text AS tot,
            COALESCE(SUM(CASE WHEN exact THEN 1 ELSE 0 END),0)::text AS ex
       FROM prediction_scores`,
  );
  const s = stats.rows[0];
  console.log(
    `[backfill] OK — ${totalUpdated} linhas atualizadas em ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
      `  total em prediction_scores: ${s?.n} linhas / ${s?.tot} pts / ${s?.ex} exatos`,
  );
  await pool.end().catch(() => {});
}

main().catch(async (err) => {
  console.error("[backfill] FATAL:", err);
  await getPool().end().catch(() => {});
  process.exit(1);
});
