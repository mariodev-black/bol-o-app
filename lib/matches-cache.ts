import { getPool } from "@/lib/db";
import { processPrizeClosuresAfterMatchSync } from "@/lib/prizes/processor";

export type CachedMatchRow = {
  competition_id: number;
  match_id: number;
  phase_key: string | null;
  group_key: string | null;
  round_key: string | null;
  status: string;
  kickoff_at: string | null;
  date_br: string;
  hour_br: string;
  result_casa: number | null;
  result_visitante: number | null;
  home_name: string;
  home_sigla: string;
  home_logo: string | null;
  away_name: string;
  away_sigla: string;
  away_logo: string | null;
  source_updated_at: string;
  synced_at: string;
};

type ProviderMatchInput = {
  matchId: number;
  phaseKey: string | null;
  groupKey: string | null;
  roundKey: string | null;
  status: string;
  kickoffAt: string | null;
  dateBR: string;
  hourBR: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  homeName: string;
  homeSigla: string;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string;
  awayLogo: string | null;
};

const CACHE_TTL_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_TTL_SECONDS ?? "60", 10) || 60;
const IDLE_SYNC_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_IDLE_SYNC_SECONDS ?? "900", 10) || 900;
const ACTIVE_SYNC_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_ACTIVE_SYNC_SECONDS ?? "60", 10) || 60;
const PRE_KICKOFF_WINDOW_MINUTES =
  Number.parseInt(process.env.MATCHES_CACHE_PRE_KICKOFF_WINDOW_MINUTES ?? "30", 10) || 30;
const LOCK_KEY = 72026;

function competitionId(): number {
  return Number.parseInt((process.env.FOOTBALL_COMPETITION_ID || "72").trim(), 10) || 72;
}

export async function readMatchesCache(): Promise<CachedMatchRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<CachedMatchRow>(
    `SELECT
      competition_id,
      match_id,
      phase_key,
      group_key,
      round_key,
      status,
      kickoff_at::text,
      date_br,
      hour_br,
      result_casa,
      result_visitante,
      home_name,
      home_sigla,
      home_logo,
      away_name,
      away_sigla,
      away_logo,
      source_updated_at::text,
      synced_at::text
     FROM matches_cache
     WHERE competition_id = $1
     ORDER BY match_id ASC`,
    [competitionId()]
  );
  return rows;
}

export async function matchesCacheIsFresh(): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{ fresh: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM matches_cache
       WHERE competition_id = $1
         AND synced_at >= now() - ($2::text || ' seconds')::interval
     ) AS fresh`,
    [competitionId(), CACHE_TTL_SECONDS]
  );
  return Boolean(rows[0]?.fresh);
}

function isLiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("andamento") || s.includes("ao vivo") || s.includes("intervalo");
}

function shouldUseActiveWindow(rows: CachedMatchRow[]): boolean {
  const now = Date.now();
  const preKickoffMs = PRE_KICKOFF_WINDOW_MINUTES * 60 * 1000;
  for (const row of rows) {
    if (isLiveStatus(row.status || "")) return true;
    if (!row.kickoff_at) continue;
    const kickoffMs = new Date(row.kickoff_at).getTime();
    if (!Number.isFinite(kickoffMs)) continue;
    if (kickoffMs >= now && kickoffMs - now <= preKickoffMs) return true;
  }
  return false;
}

async function scheduleSaysFresh(): Promise<boolean> {
  const rows = await readMatchesCache();
  if (rows.length === 0) return false;
  const activeWindow = shouldUseActiveWindow(rows);
  const freshnessSeconds = activeWindow ? ACTIVE_SYNC_SECONDS : IDLE_SYNC_SECONDS;
  const thresholdMs = Date.now() - freshnessSeconds * 1000;
  const latestSyncMs = rows.reduce((acc, row) => {
    const v = new Date(row.synced_at).getTime();
    return Number.isFinite(v) && v > acc ? v : acc;
  }, 0);
  return latestSyncMs >= thresholdMs;
}

async function upsertMatchesCache(matches: ProviderMatchInput[]) {
  if (matches.length === 0) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const m of matches) {
      await client.query(
        `INSERT INTO matches_cache (
          competition_id,
          match_id,
          phase_key,
          group_key,
          round_key,
          status,
          kickoff_at,
          date_br,
          hour_br,
          result_casa,
          result_visitante,
          home_name,
          home_sigla,
          home_logo,
          away_name,
          away_sigla,
          away_logo,
          source_updated_at,
          synced_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, now(), now()
        )
        ON CONFLICT (competition_id, match_id)
        DO UPDATE SET
          phase_key = EXCLUDED.phase_key,
          group_key = EXCLUDED.group_key,
          round_key = EXCLUDED.round_key,
          status = EXCLUDED.status,
          kickoff_at = EXCLUDED.kickoff_at,
          date_br = EXCLUDED.date_br,
          hour_br = EXCLUDED.hour_br,
          result_casa = EXCLUDED.result_casa,
          result_visitante = EXCLUDED.result_visitante,
          home_name = EXCLUDED.home_name,
          home_sigla = EXCLUDED.home_sigla,
          home_logo = EXCLUDED.home_logo,
          away_name = EXCLUDED.away_name,
          away_sigla = EXCLUDED.away_sigla,
          away_logo = EXCLUDED.away_logo,
          source_updated_at = now(),
          synced_at = now()`,
        [
          competitionId(),
          m.matchId,
          m.phaseKey,
          m.groupKey,
          m.roundKey,
          m.status,
          m.kickoffAt,
          m.dateBR,
          m.hourBR,
          m.resultCasa,
          m.resultVisitante,
          m.homeName,
          m.homeSigla,
          m.homeLogo,
          m.awayName,
          m.awaySigla,
          m.awayLogo,
        ]
      );
    }
    await client.query(
      `UPDATE matches_cache
       SET synced_at = now()
       WHERE competition_id = $1
         AND match_id NOT IN (${matches.map((_, idx) => `$${idx + 2}`).join(", ")})`,
      [competitionId(), ...matches.map((m) => m.matchId)]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function syncMatchesCache(input: {
  fetchProviderMatches: () => Promise<ProviderMatchInput[]>;
  force?: boolean;
}) {
  if (!input.force) {
    const scheduledFresh = await scheduleSaysFresh().catch(() => false);
    if (scheduledFresh) return { refreshed: false as const, reason: "scheduled-fresh" as const };
    const fresh = await matchesCacheIsFresh();
    if (fresh) return { refreshed: false as const, reason: "fresh" as const };
  }

  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) return { refreshed: false as const, reason: "locked" as const };
  } finally {
    client.release();
  }

  try {
    if (!input.force) {
      const scheduledFresh = await scheduleSaysFresh().catch(() => false);
      if (scheduledFresh) return { refreshed: false as const, reason: "scheduled-fresh-after-lock" as const };
      const fresh = await matchesCacheIsFresh();
      if (fresh) return { refreshed: false as const, reason: "fresh-after-lock" as const };
    }
    const providerMatches = await input.fetchProviderMatches();
    await upsertMatchesCache(providerMatches);
    void processPrizeClosuresAfterMatchSync();
    return { refreshed: true as const, reason: "synced" as const, count: providerMatches.length };
  } finally {
    const unlockClient = await pool.connect();
    try {
      await unlockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } finally {
      unlockClient.release();
    }
  }
}
