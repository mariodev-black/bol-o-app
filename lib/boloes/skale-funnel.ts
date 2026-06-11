import type { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  getSkaleBolaoCompetitionId,
  isSkaleBolaoEnabled,
} from "@/lib/boloes/skale-config";
import {
  SKALE_FUNNEL_COOKIE,
  SKALE_LOCKED_COOKIE,
  clearSkaleFunnelCookies,
  hasSkaleFunnelCookie,
  markSkaleFunnelLocked,
} from "@/lib/boloes/skale-funnel-shared";

export {
  SKALE_FUNNEL_COOKIE,
  SKALE_LOCKED_COOKIE,
  clearSkaleFunnelCookies,
  hasSkaleFunnelCookie,
  hasSkaleLockedCookie,
  isSkaleFunnelAllowedPath,
  markSkaleFunnelEntry,
  markSkaleFunnelLocked,
  shouldMarkSkaleFunnelFromRequest,
} from "@/lib/boloes/skale-funnel-shared";

export async function userHasPaidSkaleTicket(userId: string): Promise<boolean> {
  if (!isSkaleBolaoEnabled()) return false;
  const skaleCompId = getSkaleBolaoCompetitionId();
  const pool = getPool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM tickets
       WHERE user_id = $1::uuid
         AND ticket_type = 'extra'
         AND extra_championship_id = $2
         AND status IN ('paid', 'approved')
         AND NOT COALESCE(is_promo_bonus, false)
     ) AS ok`,
    [userId, skaleCompId],
  );
  return Boolean(rows[0]?.ok);
}

/** Sincroniza cookies de lock com o estado real (cota Skale paga libera o funil). */
export async function syncSkaleFunnelCookies(
  res: NextResponse,
  request: NextRequest,
  userId: string,
): Promise<boolean> {
  if (!hasSkaleFunnelCookie(request)) {
    clearSkaleFunnelCookies(res);
    return false;
  }

  const hasTicket = await userHasPaidSkaleTicket(userId);
  if (hasTicket) {
    clearSkaleFunnelCookies(res);
    return false;
  }

  markSkaleFunnelLocked(res);
  return true;
}
