import { getPool } from "@/lib/db";

function competitionId(): number {
  return Number.parseInt((process.env.FOOTBALL_COMPETITION_ID || "72").trim(), 10) || 72;
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
 * Ajuste via MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES (default 150 = 2h30).
 */
export function matchEndClockMinutesAfterKickoff(): number {
  const n = Number.parseInt((process.env.MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES || "150").trim(), 10);
  if (!Number.isFinite(n)) return 150;
  return Math.min(300, Math.max(45, n));
}

/**
 * True se precisamos puxar a API agora:
 * - partida com palpite, apito + carencia em horas, ainda sem placar na cache; ou
 * - apito + MATCH_END_CLOCK (minutos) ja passou no relogio atual, com palpite e sem placar (jogo devia ter terminado); ou
 * - status ja indica encerrado/finalizado mas placar ainda nulo.
 */
export async function needsForcedResultSync(): Promise<boolean> {
  const hours = guaranteeGraceHoursAfterKickoff();
  const clockMin = matchEndClockMinutesAfterKickoff();
  const pool = getPool();
  const { rows } = await pool.query<{ needs: boolean }>(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM matches_cache mc
         INNER JOIN predictions p ON p.match_id = mc.match_id
         WHERE mc.competition_id = $1
           AND mc.kickoff_at IS NOT NULL
           AND (mc.kickoff_at::timestamptz + ($2::text || ' hours')::interval) < now()
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
         WHERE mc.competition_id = $1
           AND mc.kickoff_at IS NOT NULL
           AND (mc.kickoff_at::timestamptz + ($3::text || ' minutes')::interval) < now()
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
         WHERE mc.competition_id = $1
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
     ) AS needs`,
    [competitionId(), String(hours), String(clockMin)]
  );
  return Boolean(rows[0]?.needs);
}
