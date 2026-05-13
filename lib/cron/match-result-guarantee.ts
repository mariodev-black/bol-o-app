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
 * True se existe partida com palpite registrado, ja passou o tempo de carencia apos o apito,
 * e ainda nao ha resultado oficial na cache (nem status terminal).
 */
export async function needsForcedResultSync(): Promise<boolean> {
  const hours = guaranteeGraceHoursAfterKickoff();
  const pool = getPool();
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
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
     ) AS exists`,
    [competitionId(), String(hours)]
  );
  return Boolean(rows[0]?.exists);
}
