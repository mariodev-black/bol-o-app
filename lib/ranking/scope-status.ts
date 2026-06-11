import {
  bolaoDisplayBadgeText,
  computeBolaoDisplayPhase,
  isBolaoMatchFinished,
  type BolaoDisplayPhase,
} from "@/lib/boloes/display-status";
import { bolaoPhaseScopeForPaidTicket } from "@/lib/boloes/ticket-match-scope";
import type { MatchMap } from "@/lib/football-api";
import type { PaidTicketRow } from "@/lib/payments/user-tickets";
import type { RankingScopeStatus } from "@/lib/ranking/scopes-shared";

export function bolaoDisplayPhaseForTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
): BolaoDisplayPhase {
  const sent = Math.max(0, ticket.palpitesCount ?? 0);
  const available = Math.max(0, ticket.availableGames ?? 0);
  const scope = bolaoPhaseScopeForPaidTicket(ticket, matches);
  const openInScope = scope.filter((m) => !isBolaoMatchFinished(m)).length;
  const total = Math.max(sent + available, openInScope, sent);

  return computeBolaoDisplayPhase({
    sent,
    total,
    available,
    scopeMatches: scope,
    dailyStatus: ticket.dailyStatus ?? null,
  });
}

export function rankingScopeStatusForTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
): { status: RankingScopeStatus; statusLabel: string } {
  const sent = Math.max(0, ticket.palpitesCount ?? 0);
  const pending = (ticket.availableGames ?? 0) > 0;
  const phase = bolaoDisplayPhaseForTicket(ticket, matches);

  if (phase === "pendentes") {
    return sent > 0
      ? { status: "ativa", statusLabel: "Palpites em aberto" }
      : { status: "aguardando", statusLabel: "Aguardando seus palpites" };
  }
  if (phase === "enviados") {
    return { status: "ativa", statusLabel: bolaoDisplayBadgeText("enviados") };
  }
  if (phase === "disputa") {
    return pending
      ? { status: "ativa", statusLabel: "Palpites em aberto" }
      : { status: "ativa", statusLabel: bolaoDisplayBadgeText("disputa") };
  }
  return { status: "encerrado", statusLabel: bolaoDisplayBadgeText("finalizado") };
}

export function rankingScopeStatusForGeneralTickets(
  tickets: PaidTicketRow[],
  matches: MatchMap,
): { status: RankingScopeStatus; statusLabel: string } {
  if (tickets.length === 0) {
    return { status: "encerrado", statusLabel: "Sem palpites pendentes" };
  }

  const phases = tickets.map((t) => bolaoDisplayPhaseForTicket(t, matches));
  const rank = (p: BolaoDisplayPhase) => {
    if (p === "pendentes") return 0;
    if (p === "enviados") return 1;
    if (p === "disputa") return 2;
    return 3;
  };
  const best = phases.reduce((a, b) => (rank(a) <= rank(b) ? a : b));

  const pending = tickets.some((t) => (t.availableGames ?? 0) > 0);
  if (best === "pendentes") {
    return { status: "aguardando", statusLabel: "Aguardando seus palpites" };
  }
  if (best === "enviados") {
    return { status: "ativa", statusLabel: bolaoDisplayBadgeText("enviados") };
  }
  if (best === "disputa") {
    return pending
      ? { status: "ativa", statusLabel: "Palpites em aberto" }
      : { status: "ativa", statusLabel: bolaoDisplayBadgeText("disputa") };
  }
  return { status: "encerrado", statusLabel: bolaoDisplayBadgeText("finalizado") };
}
