import { getPool } from "@/lib/db";
import { getAllSyncedCompetitionIds, getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { cronTickLog } from "@/lib/cron/cron-tick-log";
import { warmCompetitionMetadataCache } from "@/lib/competition-metadata-cache";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
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
  /** Campeonato API-Futebol; default = principal (`FOOTBALL_COMPETITION_ID`). */
  competitionId?: number;
};

/** Quanto tempo o cache DB e considerado "fresco" antes de outro sync com a API externa (default maior = menos rate). */
const CACHE_TTL_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_TTL_SECONDS ?? "120", 10) || 120;
const IDLE_SYNC_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_IDLE_SYNC_SECONDS ?? "900", 10) || 900;
/** Janela ativa (ao vivo / perto do apito): intervalo minimo entre syncs bem-sucedidos na logica scheduleSaysFresh. */
const ACTIVE_SYNC_SECONDS = Number.parseInt(process.env.MATCHES_CACHE_ACTIVE_SYNC_SECONDS ?? "120", 10) || 120;

/** No maximo um disparo nao-bloqueante de sync por este intervalo (GET partidas, fetchMatchesMap, etc.). */
const SOFT_SYNC_MIN_INTERVAL_MS =
  Number.parseInt(process.env.MATCHES_SOFT_SYNC_MIN_INTERVAL_MS ?? `${10 * 60 * 1000}`, 10) || 10 * 60 * 1000;
let lastSoftSyncRequestAt = 0;
const PRE_KICKOFF_WINDOW_MINUTES =
  Number.parseInt(process.env.MATCHES_CACHE_PRE_KICKOFF_WINDOW_MINUTES ?? "30", 10) || 30;
const LOCK_KEY = 72026;
/** `force:true`: tentativas de `pg_try_advisory_lock` antes de desistir (sync cron concorrente). */
const LOCK_RETRY_ATTEMPTS = Math.max(1, Number.parseInt(process.env.MATCHES_CACHE_LOCK_RETRY_ATTEMPTS || "40", 10) || 40);
const LOCK_RETRY_DELAY_MS = Math.max(
  50,
  Number.parseInt(process.env.MATCHES_CACHE_LOCK_RETRY_DELAY_MS || "150", 10) || 150
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function competitionId(): number {
  return getFootballMainCompetitionId();
}

export async function readMatchesCache(opts?: { competitionIds?: number[] }): Promise<CachedMatchRow[]> {
  const pool = getPool();
  const ids =
    opts?.competitionIds != null && opts.competitionIds.length > 0
      ? [...new Set(opts.competitionIds.filter((n) => Number.isFinite(n) && n > 0))]
      : getAllSyncedCompetitionIds();
  if (ids.length === 0) return [];
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
     WHERE competition_id = ANY($1::int[])
     ORDER BY competition_id ASC, match_id ASC`,
    [ids]
  );
  return rows;
}

/** Quais `match_id` existem na `matches_cache` da competicao configurada (`FOOTBALL_COMPETITION_ID`). */
export async function getExistingMatchIdsFromCache(
  matchIds: number[],
  opts?: { competitionId?: number }
): Promise<Set<number>> {
  const uniq = [...new Set(matchIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniq.length === 0) return new Set();
  const pool = getPool();
  const comp = opts?.competitionId ?? competitionId();
  try {
    const { rows } = await pool.query<{ match_id: number }>(
      `SELECT match_id FROM matches_cache WHERE competition_id = $1 AND match_id = ANY($2::int[])`,
      [comp, uniq]
    );
    return new Set(rows.map((r) => Number(r.match_id)));
  } catch (e) {
    console.error("[matches-cache] getExistingMatchIdsFromCache", e);
    return new Set(uniq);
  }
}

/**
 * Remove palpites cujo `match_id` nao esta no calendario oficial (bolao geral ou diario na UI).
 * Se `matches_cache` estiver vazia para a competicao, devolve tudo intacto (sync ainda nao populou).
 */
export async function filterPredictionsToOfficialMatchIds<T extends { match_id: number | string }>(
  predictions: T[],
  opts?: { competitionId?: number }
): Promise<T[]> {
  const ids = [
    ...new Set(
      predictions.map((p) => Number(p.match_id)).filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  if (ids.length === 0) return predictions;
  const pool = getPool();
  try {
    const comp = opts?.competitionId ?? competitionId();
    const { rows: cnt } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM matches_cache WHERE competition_id = $1`,
      [comp]
    );
    if (Number(cnt[0]?.n ?? 0) === 0) return predictions;

    const existing = await getExistingMatchIdsFromCache(ids, { competitionId: comp });
    return predictions.filter((p) => existing.has(Number(p.match_id)));
  } catch (e) {
    console.error("[matches-cache] filterPredictionsToOfficialMatchIds", e);
    return predictions;
  }
}

/**
 * Cache com status de fim de jogo mas sem mandante/visitante — GET /api/partidas deve forcar sync.
 * Ignora cancelado/adiado/suspenso onde placar pode ser intencionalmente vazio.
 */
export function matchCacheRowsTerminalWithoutScores(rows: CachedMatchRow[]): boolean {
  for (const r of rows) {
    const s = String(r.status ?? "").toLowerCase();
    if (s.includes("cancel") || s.includes("adiad") || s.includes("suspens") || s.includes("interromp")) continue;
    const terminal = s.includes("encerr") || s.includes("finaliz");
    if (terminal && (r.result_casa == null || r.result_visitante == null)) return true;
  }
  return false;
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

/** Se true, o ultimo sync ainda cobre a janela (idle ou pre-apito) — evita bater na API. */
export async function scheduleSaysFresh(): Promise<boolean> {
  const pool = getPool();
  const comp = competitionId();
  const preMin = PRE_KICKOFF_WINDOW_MINUTES;

  /** Com jogo ao vivo no DB, nao dispara sync leve na API (cota diaria); placar e atualizado pelo cron de garantia / noturno. */
  const { rows: liveRows } = await pool.query<{ live: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM matches_cache
       WHERE competition_id = $1
         AND (
           lower(coalesce(status, '')) LIKE '%andamento%'
           OR lower(coalesce(status, '')) LIKE '%ao vivo%'
           OR lower(coalesce(status, '')) LIKE '%intervalo%'
         )
     ) AS live`,
    [comp]
  );
  if (Boolean(liveRows[0]?.live)) {
    return true;
  }

  const { rows: activeRows } = await pool.query<{ active: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM matches_cache
       WHERE competition_id = $1
         AND kickoff_at IS NOT NULL
         AND kickoff_at::timestamptz > now()
         AND kickoff_at::timestamptz <= now() + (($2::text || ' minutes')::interval)
     ) AS active`,
    [comp, String(preMin)]
  );
  const activeWindow = Boolean(activeRows[0]?.active);
  const freshnessSeconds = activeWindow ? ACTIVE_SYNC_SECONDS : IDLE_SYNC_SECONDS;
  const { rows: maxRows } = await pool.query<{ latest: string | null }>(
    `SELECT max(synced_at)::text AS latest FROM matches_cache WHERE competition_id = $1`,
    [comp]
  );
  const latestMsRaw = maxRows[0]?.latest;
  const latestSyncMs = latestMsRaw ? new Date(latestMsRaw).getTime() : 0;
  if (!Number.isFinite(latestSyncMs)) return false;
  const thresholdMs = Date.now() - freshnessSeconds * 1000;
  return latestSyncMs >= thresholdMs;
}

async function upsertMatchesCache(matches: ProviderMatchInput[]) {
  if (matches.length === 0) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const byComp = new Map<number, ProviderMatchInput[]>();
    for (const m of matches) {
      const cid = m.competitionId ?? competitionId();
      const arr = byComp.get(cid) ?? [];
      arr.push(m);
      byComp.set(cid, arr);
    }
    for (const [cid, group] of byComp) {
      for (const m of group) {
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
          kickoff_at = COALESCE(matches_cache.kickoff_at, EXCLUDED.kickoff_at),
          date_br = COALESCE(NULLIF(matches_cache.date_br, ''), EXCLUDED.date_br),
          hour_br = COALESCE(NULLIF(matches_cache.hour_br, ''), EXCLUDED.hour_br),
          result_casa = COALESCE(EXCLUDED.result_casa, matches_cache.result_casa),
          result_visitante = COALESCE(EXCLUDED.result_visitante, matches_cache.result_visitante),
          home_name = EXCLUDED.home_name,
          home_sigla = EXCLUDED.home_sigla,
          home_logo = EXCLUDED.home_logo,
          away_name = EXCLUDED.away_name,
          away_sigla = EXCLUDED.away_sigla,
          away_logo = EXCLUDED.away_logo,
          source_updated_at = now(),
          synced_at = now()`,
          [
            cid,
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
         AND match_id NOT IN (${group.map((_, idx) => `$${idx + 2}`).join(", ")})`,
        [cid, ...group.map((m) => m.matchId)]
      );
    }
    await client.query("COMMIT");
    invalidateMatchMapMemoryAfterDbWrite();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Agenda sync leve com a API externa (force: false), no maximo 1 vez por SOFT_SYNC_MIN_INTERVAL_MS.
 * Evita rajadas de GET /api/partidas ou fetchMatchesMap dispararem rate limit.
 */
export function requestMatchesCacheSoftSync(fetchProviderMatches: () => Promise<ProviderMatchInput[]>): void {
  const now = Date.now();
  if (now - lastSoftSyncRequestAt < SOFT_SYNC_MIN_INTERVAL_MS) return;
  lastSoftSyncRequestAt = now;
  void syncMatchesCache({ fetchProviderMatches, force: false }).catch(() => {});
}

export async function syncMatchesCache(input: {
  fetchProviderMatches: () => Promise<ProviderMatchInput[]>;
  force?: boolean;
  /** Se definido, emite linhas `[cron-tick]` para este sync (cron / warmup). */
  cronTrace?: string;
  tickId?: string;
}) {
  const cronTrace = input.cronTrace;
  const mlog = (sub: string, extra: Record<string, unknown> = {}) => {
    if (!cronTrace) return;
    cronTickLog(`matches-cache:${sub}`, { cronTrace, tickId: input.tickId, ...extra });
  };

  if (!input.force) {
    const rowsPeek = await readMatchesCache().catch(() => []);
    const placarPendente = matchCacheRowsTerminalWithoutScores(rowsPeek);
    if (!placarPendente) {
      const scheduledFresh = await scheduleSaysFresh().catch(() => false);
      if (scheduledFresh) {
        mlog("skip", { reason: "scheduled-fresh" });
        return { refreshed: false as const, reason: "scheduled-fresh" as const };
      }
      const fresh = await matchesCacheIsFresh();
      if (fresh) {
        mlog("skip", { reason: "fresh" });
        return { refreshed: false as const, reason: "fresh" as const };
      }
    }
  }

  const pool = getPool();
  const maxLockAttempts = input.force ? LOCK_RETRY_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxLockAttempts; attempt++) {
    let acquiredLock = false;
    const lockClient = await pool.connect();
    try {
      const lockResult = await lockClient.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [LOCK_KEY]
      );
      acquiredLock = Boolean(lockResult.rows[0]?.locked);
      if (!acquiredLock) {
        mlog("lock-wait", { attempt, maxLockAttempts });
      } else {
        try {
          if (!input.force) {
            const rowsPeek2 = await readMatchesCache().catch(() => []);
            const placarPendente2 = matchCacheRowsTerminalWithoutScores(rowsPeek2);
            if (!placarPendente2) {
              const scheduledFresh = await scheduleSaysFresh().catch(() => false);
              if (scheduledFresh) {
                mlog("skip", { reason: "scheduled-fresh-after-lock" });
                return { refreshed: false as const, reason: "scheduled-fresh-after-lock" as const };
              }
              const fresh = await matchesCacheIsFresh();
              if (fresh) {
                mlog("skip", { reason: "fresh-after-lock" });
                return { refreshed: false as const, reason: "fresh-after-lock" as const };
              }
            }
          }
          mlog("fetch-start", { force: Boolean(input.force), lockAttempt: attempt });
          const providerMatches = await input.fetchProviderMatches();
          await upsertMatchesCache(providerMatches);
          void warmCompetitionMetadataCache(getAllSyncedCompetitionIds()).catch((err) =>
            console.warn("[matches-cache] warmCompetitionMetadataCache", err)
          );
          await processPrizeClosuresAfterMatchSync(
            cronTrace ? { tickId: input.tickId, source: cronTrace } : undefined
          );
          let leaderboardRevalidated = false;
          try {
            const { revalidateTag } = await import("next/cache");
            revalidateTag("leaderboard", "max");
            leaderboardRevalidated = true;
          } catch (err) {
            if (cronTrace) {
              console.warn(
                "[matches-cache] revalidateTag(leaderboard) ignorado fora do contexto de request:",
                err instanceof Error ? err.message : err
              );
            }
          }
          mlog("fetch-done", { count: providerMatches.length, leaderboardRevalidated });
          return { refreshed: true as const, reason: "synced" as const, count: providerMatches.length };
        } finally {
          await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
        }
      }
    } finally {
      lockClient.release();
    }
    if (!acquiredLock && attempt < maxLockAttempts) {
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }

  mlog("skip", { reason: "locked", attempts: maxLockAttempts });
  return { refreshed: false as const, reason: "locked" as const };
}
