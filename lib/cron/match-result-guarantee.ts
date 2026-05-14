import { getPool } from "@/lib/db";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";

function syncedCompetitionIdsForCron(): number[] {
  return getAllSyncedCompetitionIds();
}

/**
 * Horas apos o apito: se a partida ainda nao tem placar na cache, o cron de garantia forca sync com a API.
 * Ajuste via MATCH_RESULT_GUARANTEE_HOURS_AFTER_KICKOFF (default 3).
 */
export function guaranteeGraceHoursAfterKickoff(): number {
  const n = Number.parseFloat((process.env.MATCH_RESULT_GUARANTEE_HOURS_AFTER_KICKOFF || "3").trim());
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/**
 * Minutos apos o apito em que assumimos que a partida ja deveria ter acabado (relógio do servidor / DB = instante correto).
 * A cada tick (ex.: 5 min), se passou esse tempo e ainda nao ha placar na cache mas ha palpite, forca sync para processar todos.
 * Ajuste via MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES (default 115 ≈ 1h55 apos apito).
 */
export function matchEndClockMinutesAfterKickoff(): number {
  const n = Number.parseInt((process.env.MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES || "115").trim(), 10);
  if (!Number.isFinite(n)) return 115;
  return Math.min(300, Math.max(45, n));
}

/**
 * Listagem pode ficar em "andamento" sem placar oficial na cache; com MATCH_END_CLOCK alto (ex.: 150)
 * o cron nao puxava a API antes do fim do jogo real. Este limite menor (default 95) forca sync so nesses casos.
 * Ajuste via MATCH_LIVE_STUCK_FORCE_MINUTES.
 */
export function matchLiveStuckForceMinutes(): number {
  const n = Number.parseInt((process.env.MATCH_LIVE_STUCK_FORCE_MINUTES || "95").trim(), 10);
  if (!Number.isFinite(n)) return 95;
  return Math.min(180, Math.max(60, n));
}

/** `kickoff_at` na cache ou, se nulo, data/hora BR (America/Sao_Paulo). */
const EFFECTIVE_KICKOFF_SQL = `COALESCE(
  mc.kickoff_at::timestamptz,
  CASE
    WHEN mc.date_br ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}$'
      AND left(btrim(mc.hour_br), 5) ~ '^[0-2][0-9]:[0-5][0-9]$'
    THEN (
      to_timestamp(mc.date_br || ' ' || left(btrim(mc.hour_br), 5), 'DD/MM/YYYY HH24:MI')
      AT TIME ZONE 'America/Sao_Paulo'
    )
    ELSE NULL::timestamptz
  END
)`;

/**
 * True se precisamos puxar a API agora:
 * - partida com palpite, apito + carencia em horas, ainda sem placar na cache; ou
 * - apito + MATCH_END_CLOCK (minutos) ja passou no relogio atual, com palpite e sem placar (jogo devia ter terminado); ou
 * - status ja indica encerrado/finalizado mas placar ainda nulo; ou
 * - status parece ao vivo (andamento/intervalo), sem placar, apito + MATCH_LIVE_STUCK_FORCE_MINUTES (default 95).
 */
export async function needsForcedResultSync(): Promise<boolean> {
  const compIds = syncedCompetitionIdsForCron();
  if (compIds.length === 0) return false;

  const hours = guaranteeGraceHoursAfterKickoff();
  const clockMin = matchEndClockMinutesAfterKickoff();
  const stuckMin = matchLiveStuckForceMinutes();
  const pool = getPool();
  const { rows } = await pool.query<{ needs: boolean }>(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM matches_cache mc
         INNER JOIN predictions p ON p.match_id = mc.match_id
         WHERE mc.competition_id = ANY($1::int[])
           AND (${EFFECTIVE_KICKOFF_SQL}) IS NOT NULL
           AND ((${EFFECTIVE_KICKOFF_SQL}) + ($2::text || ' hours')::interval) < now()
           AND mc.result_casa IS NULL
           AND mc.result_visitante IS NULL
           AND NOT (
             lower(mc.status) LIKE '%encerr%'
             OR lower(mc.status) LIKE '%finaliz%'
             OR lower(mc.status) LIKE '%cancel%'
             OR lower(mc.status) LIKE '%adiad%'
             OR lower(mc.status) LIKE '%suspens%'
             OR lower(mc.status) LIKE '%interromp%'
           )
       )
       OR EXISTS (
         SELECT 1
         FROM matches_cache mc
         INNER JOIN predictions p ON p.match_id = mc.match_id
         WHERE mc.competition_id = ANY($1::int[])
           AND (${EFFECTIVE_KICKOFF_SQL}) IS NOT NULL
           AND ((${EFFECTIVE_KICKOFF_SQL}) + ($3::text || ' minutes')::interval) < now()
           AND mc.result_casa IS NULL
           AND mc.result_visitante IS NULL
           AND NOT (
             lower(mc.status) LIKE '%cancel%'
             OR lower(mc.status) LIKE '%adiad%'
             OR lower(mc.status) LIKE '%suspens%'
             OR lower(mc.status) LIKE '%interromp%'
           )
       )
       OR EXISTS (
         SELECT 1
         FROM matches_cache mc
         WHERE mc.competition_id = ANY($1::int[])
           AND (
             lower(mc.status) LIKE '%encerr%'
             OR lower(mc.status) LIKE '%finaliz%'
           )
           AND (mc.result_casa IS NULL OR mc.result_visitante IS NULL)
           AND NOT (
             lower(mc.status) LIKE '%cancel%'
             OR lower(mc.status) LIKE '%adiad%'
             OR lower(mc.status) LIKE '%suspens%'
             OR lower(mc.status) LIKE '%interromp%'
           )
       )
       OR EXISTS (
         SELECT 1
         FROM matches_cache mc
         INNER JOIN predictions p ON p.match_id = mc.match_id
         WHERE mc.competition_id = ANY($1::int[])
           AND (${EFFECTIVE_KICKOFF_SQL}) IS NOT NULL
           AND ((${EFFECTIVE_KICKOFF_SQL}) + ($4::text || ' minutes')::interval) < now()
           AND mc.result_casa IS NULL
           AND mc.result_visitante IS NULL
           AND (
             lower(coalesce(mc.status, '')) LIKE '%andamento%'
             OR lower(coalesce(mc.status, '')) LIKE '%intervalo%'
             OR lower(coalesce(mc.status, '')) LIKE '%ao_vivo%'
             OR lower(coalesce(mc.status, '')) LIKE '%ao vivo%'
             OR lower(coalesce(mc.status, '')) LIKE '%em curso%'
           )
           AND NOT (
             lower(mc.status) LIKE '%cancel%'
             OR lower(mc.status) LIKE '%adiad%'
             OR lower(mc.status) LIKE '%suspens%'
             OR lower(mc.status) LIKE '%interromp%'
           )
       )
     ) AS needs`,
    [compIds, String(hours), String(clockMin), String(stuckMin)]
  );
  return Boolean(rows[0]?.needs);
}

/** Minutos sem atualizar `matches_cache.synced_at` para considerar “atrasado” no tick (pode puxar API). Default 10. */
export function matchCronStaleRefreshMinutes(): number {
  const n = Number.parseInt((process.env.MATCH_CRON_STALE_REFRESH_MINUTES || "10").trim(), 10);
  return Number.isFinite(n) && n >= 5 && n <= 180 ? n : 10;
}

/**
 * Após apito + N minutos: se ainda não houve sync desde esse instante, força refresh
 * (garante tentativa de placar mesmo com horário/API defasados). Default 10.
 */
export function matchPostKickoffFirstSyncMinutes(): number {
  const n = Number.parseInt((process.env.MATCH_POST_KICKOFF_FIRST_SYNC_MINUTES || "10").trim(), 10);
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : 10;
}

/**
 * Partida já iniciada com cache velho: palpite ou ao vivo, **ou** qualquer jogo com apito nas últimas 48h
 * (atualiza placar após o fim sem depender só de “em andamento” no DB).
 */
export async function needsStaleMatchCacheForApiSync(): Promise<boolean> {
  const compIds = syncedCompetitionIdsForCron();
  if (compIds.length === 0) return false;

  const staleMins = matchCronStaleRefreshMinutes();
  const postKoMins = matchPostKickoffFirstSyncMinutes();
  const pool = getPool();
  const { rows } = await pool.query<{ needs: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM matches_cache mc
       WHERE mc.competition_id = ANY($1::int[])
         AND (${EFFECTIVE_KICKOFF_SQL}) IS NOT NULL
         AND (${EFFECTIVE_KICKOFF_SQL}) < now()
         AND (${EFFECTIVE_KICKOFF_SQL}) > now() - interval '48 hours'
         AND NOT (
           lower(coalesce(mc.status, '')) LIKE '%cancel%'
           OR lower(coalesce(mc.status, '')) LIKE '%adiad%'
           OR lower(coalesce(mc.status, '')) LIKE '%suspens%'
           OR lower(coalesce(mc.status, '')) LIKE '%interromp%'
         )
         AND NOT (
           (lower(coalesce(mc.status, '')) LIKE '%encerr%' OR lower(coalesce(mc.status, '')) LIKE '%finaliz%')
           AND mc.result_casa IS NOT NULL
           AND mc.result_visitante IS NOT NULL
         )
         AND (
           mc.synced_at < now() - ($2::text || ' minutes')::interval
           OR (
             (${EFFECTIVE_KICKOFF_SQL}) + ($3::text || ' minutes')::interval < now()
             AND mc.synced_at < (${EFFECTIVE_KICKOFF_SQL}) + ($3::text || ' minutes')::interval
           )
         )
     ) AS needs`,
    [compIds, String(staleMins), String(postKoMins)],
  );
  return Boolean(rows[0]?.needs);
}

async function logMatchRefreshDebugSnapshot(breakdown: {
  needsRefresh: boolean;
  forcedResultSync: boolean;
  staleCache: boolean;
}): Promise<void> {
  const raw = (process.env.MATCH_REFRESH_DEBUG || "").trim().toLowerCase();
  if (!["1", "true", "yes"].includes(raw)) return;
  const compIds = syncedCompetitionIdsForCron();
  if (compIds.length === 0) return;
  const stuckMin = matchLiveStuckForceMinutes();
  const clockMin = matchEndClockMinutesAfterKickoff();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (mc.competition_id, mc.match_id)
        mc.competition_id,
        mc.match_id,
        mc.status,
        mc.result_casa,
        mc.result_visitante,
        mc.kickoff_at::text AS kickoff_at,
        mc.date_br,
        mc.hour_br,
        (${EFFECTIVE_KICKOFF_SQL})::text AS eff_ko,
        mc.synced_at::text AS synced_at,
        ((${EFFECTIVE_KICKOFF_SQL}) + ($2::text || ' minutes')::interval) < now() AS past_match_end_clock,
        ((${EFFECTIVE_KICKOFF_SQL}) + ($3::text || ' minutes')::interval) < now() AS past_live_stuck_force
     FROM matches_cache mc
     INNER JOIN predictions p ON p.match_id = mc.match_id
     WHERE mc.competition_id = ANY($1::int[])
       AND (${EFFECTIVE_KICKOFF_SQL}) IS NOT NULL
       AND mc.result_casa IS NULL
       AND mc.result_visitante IS NULL
     ORDER BY mc.competition_id, mc.match_id, (${EFFECTIVE_KICKOFF_SQL}) ASC NULLS LAST
     LIMIT 30`,
    [compIds, String(clockMin), String(stuckMin)]
  );
  console.info(
    "[match-refresh-debug]",
    JSON.stringify({
      breakdown,
      clockMin,
      stuckMin,
      sampleNullScorePredicted: rows,
    })
  );
}

/** Diagnóstico em uma rodada (evita duas idas ao DB em sequência). */
export async function getMatchApiRefreshBreakdown(): Promise<{
  needsRefresh: boolean;
  forcedResultSync: boolean;
  staleCache: boolean;
}> {
  const [forcedResultSync, staleCache] = await Promise.all([
    needsForcedResultSync(),
    needsStaleMatchCacheForApiSync(),
  ]);
  const out = {
    needsRefresh: forcedResultSync || staleCache,
    forcedResultSync,
    staleCache,
  };
  await logMatchRefreshDebugSnapshot(out).catch(() => {});
  return out;
}

/** Tick de manutenção: só vale gastar cota da API se há pendência real ou cache defasado. */
export async function needsMatchApiRefreshForCron(): Promise<boolean> {
  const b = await getMatchApiRefreshBreakdown();
  return b.needsRefresh;
}
