import { getPool } from "@/lib/db";

export function standingsCacheKey(competitionId: number | string): string {
  return `standings:${competitionId}`;
}

export function fasesEnrichmentCacheKey(competitionId: number | string): string {
  return `fases_enrichment:${competitionId}`;
}

export async function readFootballApiCacheJson(cacheKey: string): Promise<unknown | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ payload: unknown }>(
    `SELECT payload FROM football_api_cache WHERE cache_key = $1`,
    [cacheKey]
  );
  return rows[0]?.payload ?? null;
}

export async function upsertFootballApiCache(cacheKey: string, competitionId: number, payload: unknown): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO football_api_cache (cache_key, competition_id, payload, synced_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (cache_key) DO UPDATE SET
       competition_id = EXCLUDED.competition_id,
       payload = EXCLUDED.payload,
       synced_at = now()`,
    [cacheKey, competitionId, JSON.stringify(payload ?? null)]
  );
}
