import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isBolaoScopeRoundComplete } from "@/lib/boloes/display-status";
import {
  bolaoPhaseScopeForPaidTicket,
  bolaoPhaseScopeFromPredictions,
  paidTicketExtraRoundNumber,
} from "@/lib/boloes/ticket-match-scope";
import { effectiveExtraRoundForPaidTicket } from "@/lib/ticket-shop-extra-display";
import { getPool } from "@/lib/db";
import { brToday, minBrDate, resolveDiarioPlayableDate, utcMsForBrDate } from "@/lib/diario-playable-date";
import { fetchMatchesMap, getMatchFromMap, type MatchMap } from "@/lib/football-api";
import { listPredictionTicketMatchPairsForUser, palpiteLockBeforeKickoffMs } from "@/lib/predictions";

export type PaidTicketRow = {
  id: string;
  ticketType: "general" | "daily" | "extra";
  quantity: number;
  paidAt: string | null;
  createdAt: string;
  extraChampionshipId?: number | null;
  /** Bolão extra por rodada (`tickets.round_number`). */
  extraRoundNumber?: number | null;
  isPromoBonus?: boolean;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  playDate?: string | null;
  availableGames?: number;
  /** Palpites já enviados nesta cota. */
  palpitesCount?: number;
};

function isFinishedStatus(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

function parseKickoffUtcMs(dateBR?: string, hourBR?: string): number | null {
  if (!dateBR) return null;
  const [d, m, y] = String(dateBR).split("/");
  if (!d || !m || !y) return null;
  const [hh, mm] = String(hourBR || "00:00").split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

type OpenMatch = {
  matchId: number;
  dateBR: string;
  status: string;
  competitionId: number;
  kickoffAt: number | null;
};

/** Tickets com pagamento confirmado (origem do banco — fonte de verdade). */
export async function listPaidTicketsForUser(
  userId: string,
  opts?: { matchMap?: MatchMap },
): Promise<PaidTicketRow[]> {
  const pool = getPool();
  const mainComp = getFootballMainCompetitionId();
  try {
    const preloadedMatchMap = opts?.matchMap;
    const [{ rows }, matchMap, preds] = await Promise.all([
      pool.query<{
        id: string;
        ticket_type: "general" | "daily" | "extra";
        extra_championship_id: number | null;
        round_number: number | null;
        is_promo_bonus: boolean;
        total_amount_cents: number | null;
        quantity: number;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `SELECT id, ticket_type, extra_championship_id, round_number,
                COALESCE(is_promo_bonus, false) AS is_promo_bonus,
                COALESCE(total_amount_cents, 0) AS total_amount_cents,
                quantity, paid_at, created_at
         FROM tickets
         WHERE user_id = $1 AND status = 'paid'
         ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST, created_at DESC`,
        [userId]
      ),
      preloadedMatchMap != null
        ? Promise.resolve(preloadedMatchMap)
        : fetchMatchesMap().catch(() => new Map() as MatchMap),
      listPredictionTicketMatchPairsForUser(userId).catch(() => [] as { ticket_id: string; match_id: number }[]),
    ]);
    const mapped = rows.map((r) => {
      const compId = r.ticket_type === "extra" ? r.extra_championship_id : null;
      const compNum =
        compId != null && Number.isFinite(Number(compId)) ? Number(compId) : 0;
      const extraRoundNumber: number | null =
        r.ticket_type === "extra" && compNum > 0
          ? effectiveExtraRoundForPaidTicket({
              championshipId: compNum,
              roundNumberFromDb: r.round_number,
            })
          : null;
      return {
        id: r.id,
        ticketType: r.ticket_type,
        extraChampionshipId: compId,
        extraRoundNumber,
        isPromoBonus:
          Boolean(r.is_promo_bonus) ||
          (r.ticket_type === "extra" && Number(r.total_amount_cents ?? 0) === 0),
        quantity: Math.max(1, r.quantity),
        paidAt: r.paid_at ? r.paid_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
      };
    });
    if (!matchMap.size) {
      return mapped.map((t) => ({
        ...t,
        dailyStatus:
          t.ticketType === "daily" || t.ticketType === "extra" ? ("disponivel" as const) : undefined,
        playDate: t.ticketType === "daily" || t.ticketType === "extra" ? brToday() : undefined,
        availableGames: 0,
        palpitesCount: 0,
      }));
    }

    const now = Date.now();
    const today = brToday();
    const todayMs = utcMsForBrDate(today) ?? now;

    const buildOpenMatches = (leadMs: number): OpenMatch[] =>
      Array.from(matchMap.values())
        .map((m) => ({
          matchId: m.id,
          dateBR: m.dateBR,
          status: m.status,
          competitionId: Number(m.competitionId) || mainComp,
          kickoffAt: parseKickoffUtcMs(m.dateBR, m.hour),
        }))
        .filter((m) => {
          const finished = isFinishedStatus(m.status);
          const lockAt = m.kickoffAt != null ? m.kickoffAt - leadMs : null;
          const dateMs = m.dateBR ? utcMsForBrDate(m.dateBR) : null;
          const stillOpenByTime = lockAt != null ? lockAt > now : (dateMs ?? 0) >= todayMs;
          return !finished && stillOpenByTime;
        });

    const openMatchesDefaultLock = buildOpenMatches(palpiteLockBeforeKickoffMs("diario"));
    const openMatchesExtraLock = buildOpenMatches(palpiteLockBeforeKickoffMs("extra"));

    const byTicket = new Map<string, { ticket_id: string; match_id: number }[]>();
    for (const p of preds) {
      const arr = byTicket.get(p.ticket_id) ?? [];
      arr.push(p);
      byTicket.set(p.ticket_id, arr);
    }

    const result = mapped.map((t) => {
      const ticketPreds = byTicket.get(t.id) ?? [];
      const palpitesCount = ticketPreds.length;

      if (t.ticketType === "general") {
        const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
        const openMain = openMatchesDefaultLock.filter((m) => m.competitionId === mainComp);
        const availableGames = openMain.reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
        return { ...t, availableGames, palpitesCount };
      }

      const scopeComp = t.ticketType === "daily" ? mainComp : Number(t.extraChampionshipId);
      if (!Number.isFinite(scopeComp) || scopeComp <= 0) {
        return { ...t, dailyStatus: "disponivel" as const, playDate: brToday(), availableGames: 0 };
      }

      const scopeOpen =
        t.ticketType === "daily"
          ? openMatchesDefaultLock.filter((m) => m.competitionId === scopeComp)
          : openMatchesExtraLock.filter((m) => m.competitionId === scopeComp);
      const playableDate = resolveDiarioPlayableDate(matchMap, { competitionId: scopeComp });
      const extraRound = paidTicketExtraRoundNumber(t);

      const openInTicketScope = (om: OpenMatch): boolean => {
        if (extraRound == null) return om.dateBR === playableDate;
        const m = getMatchFromMap(matchMap, scopeComp, om.matchId);
        return m != null && Number(m.rodada) === extraRound;
      };

      if (palpitesCount === 0) {
        const availableGames = scopeOpen.filter(openInTicketScope).length;
        return { ...t, dailyStatus: "disponivel" as const, playDate: playableDate, availableGames, palpitesCount: 0 };
      }

      const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
      const matchDates = new Set<string>();
      for (const p of ticketPreds) {
        const m = getMatchFromMap(matchMap, scopeComp, Number(p.match_id));
        if (m?.dateBR) matchDates.add(m.dateBR);
      }

      const predMatchIds = ticketPreds.map((p) => Number(p.match_id));
      const phaseScope = bolaoPhaseScopeForPaidTicket(t, matchMap, predMatchIds);
      const predOnlyScope = bolaoPhaseScopeFromPredictions(t, matchMap, predMatchIds);

      const predDate = minBrDate(matchDates);
      const targetDate = predDate ?? playableDate;
      const availableGames = scopeOpen
        .filter(openInTicketScope)
        .reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
      const roundDone = isBolaoScopeRoundComplete(phaseScope, now);
      const userGamesDone =
        predOnlyScope.length > 0 && isBolaoScopeRoundComplete(predOnlyScope, now);
      const dailyStatus: NonNullable<PaidTicketRow["dailyStatus"]> =
        roundDone || (palpitesCount > 0 && availableGames === 0 && userGamesDone)
          ? "usado"
          : "em_uso";
      return { ...t, dailyStatus, playDate: targetDate, availableGames, palpitesCount };
    });
    return result;
  } catch (e) {
    console.error("[user-tickets] listPaidTicketsForUser", e);
    return [];
  }
}
