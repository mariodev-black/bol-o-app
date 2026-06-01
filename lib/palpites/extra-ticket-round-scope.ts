import "server-only";

import { getPool } from "@/lib/db";
import { fetchMatchesMap, getMatchFromMap, type MatchMap } from "@/lib/football-api";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import { resolveEffectiveExtraRoundForTicket } from "@/lib/football/extras-rodada";

export type ExtraTicketRoundScope = {
  competitionId: number;
  poolRodada: number;
  poolPlayDate: string;
};

type MatchInfo = NonNullable<ReturnType<MatchMap["get"]>>;

/** Rodada do pool desta cota extra — mesma regra do ranking (`leaderboard.ts`). */
export async function resolveExtraTicketRoundScope(
  ticketId: string,
): Promise<ExtraTicketRoundScope | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    extra_championship_id: number | null;
    round_number: number | null;
  }>(
    `SELECT extra_championship_id, round_number
     FROM tickets
     WHERE id::text = $1
       AND ticket_type = 'extra'
       AND status IN ('paid', 'approved')
     LIMIT 1`,
    [ticketId],
  );
  const row = rows[0];
  if (!row?.extra_championship_id) return null;

  const competitionId = Number(row.extra_championship_id);
  if (!Number.isFinite(competitionId) || competitionId <= 0) return null;

  const fromDb =
    row.round_number != null &&
    Number.isFinite(Number(row.round_number)) &&
    Number(row.round_number) > 0
      ? Math.trunc(Number(row.round_number))
      : null;

  const effective = await resolveEffectiveExtraRoundForTicket(
    competitionId,
    fromDb,
    { allowProviderCall: false },
  );
  const poolRodada = effective?.rodada ?? fromDb;
  if (poolRodada == null || poolRodada <= 0) return null;

  const matches = await fetchMatchesMap().catch(() => new Map() as MatchMap);
  const playable = resolveDiarioPlayableDate(matches, { competitionId });
  let poolPlayDate = playable;
  for (const m of matches.values()) {
    if (Number(m.competitionId) === competitionId && m.rodada === poolRodada && m.dateBR) {
      poolPlayDate = m.dateBR;
      break;
    }
  }

  return { competitionId, poolRodada, poolPlayDate };
}

/** Partida pertence à rodada do bolão extra (igual `matchInExtraPool` no ranking). */
export function matchBelongsToExtraTicketRound(
  match: MatchInfo | undefined,
  scope: ExtraTicketRoundScope,
): boolean {
  if (!match || Number(match.competitionId) !== scope.competitionId) return false;
  if (scope.poolRodada > 0 && match.rodada != null && match.rodada > 0) {
    return match.rodada === scope.poolRodada;
  }
  return match.dateBR === scope.poolPlayDate;
}

export function filterPredictionsForExtraTicketRound<
  T extends { ticket_id: string; bolao_type: string; match_id: number | string },
>(predictions: T[], scope: ExtraTicketRoundScope, matches: MatchMap): T[] {
  return predictions.filter((p) => {
    if (p.bolao_type !== "extra") return true;
    const matchId = Number(p.match_id);
    if (!Number.isFinite(matchId)) return false;
    const mi = getMatchFromMap(matches, scope.competitionId, matchId);
    return matchBelongsToExtraTicketRound(mi, scope);
  });
}
