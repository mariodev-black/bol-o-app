import type { BolaoMatchPhaseInput } from "@/lib/boloes/display-status";
import {
  getDailyEditionDatesSet,
  paidTicketDailyEditionNumber,
} from "@/lib/boloes/daily-editions";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { skaleScopeMatchesFromMap } from "@/lib/boloes/skale-match-resolve";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import { resolveBolaoMatchFromMap } from "@/lib/boloes/skale-match-resolve";
import { type MatchMap, type MatchMapEntry } from "@/lib/football-api";
import type { PaidTicketRow } from "@/lib/payments/user-tickets";

export function matchToBolaoPhaseInput(
  match: Pick<
    MatchMapEntry,
    "status" | "kickoffAt" | "dateBR" | "hour" | "resultCasa" | "resultVisitante"
  >,
): BolaoMatchPhaseInput {
  return {
    status: match.status,
    kickoffAt: match.kickoffAt,
    dateBR: match.dateBR,
    hour: match.hour,
    resultCasa: match.resultCasa,
    resultVisitante: match.resultVisitante,
  };
}

/**
 * Escopo para status do bolão (fase na vitrine).
 * Se a rodada não estiver no cache, usa as partidas em que o usuário já palpitou.
 */
function extraScopeCompetitionId(ticket: PaidTicketRow): number | null {
  const mainComp = getFootballMainCompetitionId();
  const comp =
    ticket.ticketType === "extra"
      ? Number(ticket.extraChampionshipId)
      : mainComp;
  return Number.isFinite(comp) && comp > 0 ? comp : null;
}

/** Partidas do cache em que o usuário já enviou palpite nesta cota. */
export function matchEntriesFromPredictions(
  ticket: PaidTicketRow,
  matches: MatchMap,
  predictionMatchIds?: ReadonlyArray<number>,
): MatchMapEntry[] {
  const comp = extraScopeCompetitionId(ticket);
  if (comp == null || !predictionMatchIds?.length) return [];

  const out: MatchMapEntry[] = [];
  for (const rawId of predictionMatchIds) {
    const mid = Number(rawId);
    if (!Number.isFinite(mid)) continue;
    const m = resolveBolaoMatchFromMap(matches, comp, mid);
    if (m) out.push(m);
  }
  return out;
}

export function bolaoPhaseScopeFromPredictions(
  ticket: PaidTicketRow,
  matches: MatchMap,
  predictionMatchIds?: ReadonlyArray<number>,
): BolaoMatchPhaseInput[] {
  return matchEntriesFromPredictions(ticket, matches, predictionMatchIds).map(
    matchToBolaoPhaseInput,
  );
}

export function bolaoPhaseScopeForPaidTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
  predictionMatchIds?: ReadonlyArray<number>,
  scopeOpts?: ScopeMatchesForPaidTicketOpts,
): BolaoMatchPhaseInput[] {
  const scoped = scopeMatchesForPaidTicket(ticket, matches, scopeOpts);
  if (scoped.length > 0) {
    return scoped.map(matchToBolaoPhaseInput);
  }
  return bolaoPhaseScopeFromPredictions(ticket, matches, predictionMatchIds);
}

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

export type ScopeMatchesForPaidTicketOpts = {
  /** Rodada fixa da cota — sobrescreve fallback legado por dia jogável. */
  extraRoundNumber?: number | null;
};

/** Partidas que definem prazo, progresso e fase do bolão desta cota. */
export function scopeMatchesForPaidTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
  opts?: ScopeMatchesForPaidTicketOpts,
): MatchMapEntry[] {
  const list = Array.from(matches.values());
  const mainComp = getFootballMainCompetitionId();

  if (ticket.ticketType === "general") {
    return list.filter((m) => (Number(m.competitionId) || mainComp) === mainComp);
  }

  if (ticket.ticketType === "daily") {
    const edition = paidTicketDailyEditionNumber(ticket);
    if (edition != null) {
      const dateSet = getDailyEditionDatesSet(edition);
      return list.filter(
        (m) =>
          m.dateBR != null &&
          dateSet.has(m.dateBR) &&
          (Number(m.competitionId) || mainComp) === mainComp,
      );
    }
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

  if (isSkaleBolaoCompetition(comp)) {
    return skaleScopeMatchesFromMap(matches, comp);
  }

  const round =
    opts?.extraRoundNumber != null &&
    Number.isFinite(Number(opts.extraRoundNumber)) &&
    Number(opts.extraRoundNumber) > 0
      ? Number(opts.extraRoundNumber)
      : paidTicketExtraRoundNumber(ticket);
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
