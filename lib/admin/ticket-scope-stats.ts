import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { getDailyEdition } from "@/lib/boloes/daily-editions";
import {
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoCompetition,
} from "@/lib/boloes/skale-config";
import {
  isSkaleDailyBolaoCompetition,
} from "@/lib/boloes/skale-daily-config";
import {
  getWeekendBolaoSourceCopaCompetitionId,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";
import { isFullCopaMirrorBolao } from "@/lib/boloes/skale-match-resolve";
import type { Pool } from "pg";

export type TicketScopeInput = {
  ticketType: string;
  extraChampionshipId: number | null;
  roundNumber: number | null;
};

export function resolveTicketMatchCompetitionIds(ticket: TicketScopeInput): number[] {
  const mainComp = getFootballMainCompetitionId();
  const type = String(ticket.ticketType ?? "").toLowerCase();

  if (type === "general" || type === "daily") {
    return [mainComp];
  }

  const compId = ticket.extraChampionshipId;
  if (compId == null) return [mainComp];

  if (isFullCopaMirrorBolao(compId)) {
    const copaId = isSkaleBolaoCompetition(compId)
      ? getSkaleBolaoSourceCopaCompetitionId()
      : getWeekendBolaoSourceCopaCompetitionId();
    return compId === copaId ? [compId] : [compId, copaId];
  }

  if (isSkaleDailyBolaoCompetition(compId)) {
    const copaId = getSkaleBolaoSourceCopaCompetitionId();
    return compId === copaId ? [compId] : [compId, copaId];
  }

  return [compId];
}

export async function countMatchesInTicketScope(
  pool: Pool,
  ticket: TicketScopeInput,
  firstPredictionDateBr?: string | null,
): Promise<number> {
  const mainComp = getFootballMainCompetitionId();
  const type = String(ticket.ticketType ?? "").toLowerCase();
  const compId = ticket.extraChampionshipId;

  if (type === "general") {
    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM matches_cache WHERE competition_id = $1`,
      [mainComp],
    );
    return rows[0]?.c ?? 0;
  }

  if (type === "daily") {
    const dateBr = firstPredictionDateBr?.trim();
    if (dateBr) {
      const { rows } = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM matches_cache WHERE competition_id = $1 AND date_br = $2`,
        [mainComp, dateBr],
      );
      return rows[0]?.c ?? 0;
    }
    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM matches_cache
       WHERE competition_id = $1
         AND date_br = (
           SELECT date_br FROM matches_cache
           WHERE competition_id = $1
           ORDER BY
             CASE WHEN to_date(date_br, 'DD/MM/YYYY') >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0 ELSE 1 END,
             to_date(date_br, 'DD/MM/YYYY') ASC
           LIMIT 1
         )`,
      [mainComp],
    );
    return rows[0]?.c ?? 0;
  }

  if (type === "extra" && compId != null) {
    if (isFullCopaMirrorBolao(compId)) {
      const ids = resolveTicketMatchCompetitionIds(ticket);
      const { rows } = await pool.query<{ c: number }>(
        `SELECT COUNT(DISTINCT match_id)::int AS c
         FROM matches_cache
         WHERE competition_id = ANY($1::int[])`,
        [ids],
      );
      return rows[0]?.c ?? 0;
    }

    if (isSkaleDailyBolaoCompetition(compId)) {
      const edition = ticket.roundNumber;
      if (edition != null && edition > 0) {
        const meta = getDailyEdition(edition);
        if (meta?.datesBR?.length) {
          const ids = resolveTicketMatchCompetitionIds(ticket);
          const { rows } = await pool.query<{ c: number }>(
            `SELECT COUNT(DISTINCT match_id)::int AS c
             FROM matches_cache
             WHERE competition_id = ANY($1::int[])
               AND date_br = ANY($2::text[])`,
            [ids, meta.datesBR],
          );
          return rows[0]?.c ?? 0;
        }
      }
    }

    const round = ticket.roundNumber;
    if (round != null && round > 0) {
      const { rows } = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM matches_cache WHERE competition_id = $1 AND rodada = $2`,
        [compId, round],
      );
      return rows[0]?.c ?? 0;
    }

    const dateBr = firstPredictionDateBr?.trim();
    if (dateBr) {
      const { rows } = await pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM matches_cache WHERE competition_id = $1 AND date_br = $2`,
        [compId, dateBr],
      );
      return rows[0]?.c ?? 0;
    }
  }

  return 0;
}

export async function loadFirstPredictionDateBr(
  pool: Pool,
  ticketId: string,
  competitionIds: number[],
): Promise<string | null> {
  const { rows } = await pool.query<{ date_br: string | null }>(
    `SELECT mc.date_br
     FROM predictions p
     JOIN matches_cache mc ON mc.match_id = p.match_id
       AND mc.competition_id = ANY($2::int[])
     WHERE p.ticket_id::text = $1::text
       AND mc.date_br IS NOT NULL
     ORDER BY p.submitted_at ASC
     LIMIT 1`,
    [ticketId, competitionIds],
  );
  return rows[0]?.date_br ?? null;
}
