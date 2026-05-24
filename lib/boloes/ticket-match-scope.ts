import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import type { MatchMap, MatchMapEntry } from "@/lib/football-api";
import type { PaidTicketRow } from "@/lib/payments/user-tickets";

/** Rodada fixa do ticket extra (`tickets.round_number`). */
export function paidTicketExtraRoundNumber(
  ticket: Pick<PaidTicketRow, "ticketType" | "extraRoundNumber">,
): number | null {
  if (ticket.ticketType !== "extra") return null;
  const n = ticket.extraRoundNumber;
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
  return Number(n);
}

export function isExtraTicketByRound(
  ticket: Pick<PaidTicketRow, "ticketType" | "extraRoundNumber">,
): boolean {
  return paidTicketExtraRoundNumber(ticket) != null;
}

/** Partidas que definem prazo, progresso e fase do bolão desta cota. */
export function scopeMatchesForPaidTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
): MatchMapEntry[] {
  const list = Array.from(matches.values());
  const mainComp = getFootballMainCompetitionId();

  if (ticket.ticketType === "general") {
    return list.filter((m) => (Number(m.competitionId) || mainComp) === mainComp);
  }

  if (ticket.ticketType === "daily") {
    const date =
      ticket.playDate ||
      resolveDiarioPlayableDate(matches, { competitionId: mainComp });
    return list.filter(
      (m) =>
        m.dateBR === date && (Number(m.competitionId) || mainComp) === mainComp,
    );
  }

  const comp = Number(ticket.extraChampionshipId);
  if (!Number.isFinite(comp) || comp <= 0) return [];

  const round = paidTicketExtraRoundNumber(ticket);
  if (round != null) {
    return list.filter(
      (m) =>
        (Number(m.competitionId) || comp) === comp && Number(m.rodada) === round,
    );
  }

  const date =
    ticket.playDate ||
    resolveDiarioPlayableDate(matches, { competitionId: comp });
  return list.filter(
    (m) => m.dateBR === date && (Number(m.competitionId) || comp) === comp,
  );
}
