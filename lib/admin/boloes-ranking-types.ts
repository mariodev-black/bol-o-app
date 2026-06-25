/** Tipos e constantes do ranking admin — seguros para Client Components (sem pg/db). */

import { isSkaleDailyBolaoCompetition } from "@/lib/boloes/skale-daily-config";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { isWeekendBolaoCompetition } from "@/lib/boloes/weekend-bolao-config";

function isFullCopaMirrorBolaoCompetition(
  championshipId: number | undefined | null,
): boolean {
  return (
    isSkaleBolaoCompetition(championshipId) ||
    isWeekendBolaoCompetition(championshipId)
  );
}

export type AdminBolaoRankingRow = {
  position: number;
  ticketId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  ticketType: string;
  extraChampionshipId: number | null;
  bolaoDefinitionId: string | null;
  isPromoBonus: boolean;
  groupDate: string | null;
  groupRound: number | null;
  scorePoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  predictionsCount: number;
  pendingPredictionsCount: number;
  totalMatchesCount: number;
  paidAt: string | null;
  createdAt: string;
};

export type AdminBolaoRankingScope =
  | { type: "principal" }
  | { type: "daily"; date: string }
  | { type: "extra"; key: string }
  | { type: "definition"; id: string };

export type AdminBolaoRankingSummary = {
  ticketsCount: number;
  playersCount: number;
  totalPoints: number;
  finishedCount: number;
  promoTicketsCount: number;
};

export const ADMIN_BOLAO_RANKING_PAGE_SIZE = 40;

export type ParsedExtraBolaoScopeKey =
  | { mode: "round"; championshipId: number; rodada: number }
  | { mode: "copa"; championshipId: number }
  | { mode: "skale-daily"; championshipId: number; edition: number }
  | { mode: "definition"; definitionId: string };

export function parseExtraBolaoScopeKey(key: string): ParsedExtraBolaoScopeKey | null {
  const trimmed = key.trim();
  const copa = /^(\d+):copa$/.exec(trimmed);
  if (copa) {
    const championshipId = Number(copa[1]);
    if (!Number.isFinite(championshipId) || championshipId <= 0) return null;
    return { mode: "copa", championshipId };
  }

  const daily = /^(\d+):daily:(\d+)$/.exec(trimmed);
  if (daily) {
    const championshipId = Number(daily[1]);
    const edition = Number(daily[2]);
    if (!Number.isFinite(championshipId) || championshipId <= 0) return null;
    if (!Number.isFinite(edition) || edition < 1) return null;
    return { mode: "skale-daily", championshipId, edition };
  }

  const round = /^(\d+):r(\d+)$/.exec(trimmed);
  if (round) {
    const championshipId = Number(round[1]);
    const rodada = Number(round[2]);
    if (!Number.isFinite(championshipId) || championshipId <= 0) return null;
    if (!Number.isFinite(rodada) || rodada < 1) return null;
    return { mode: "round", championshipId, rodada };
  }

  const definition = /^def:([0-9a-f-]{36})$/i.exec(trimmed);
  if (definition) {
    return { mode: "definition", definitionId: definition[1] };
  }

  return null;
}

export function matchesExtraBolaoScopeRow(
  row: Pick<
    AdminBolaoRankingRow,
    "ticketType" | "extraChampionshipId" | "bolaoDefinitionId" | "groupRound"
  >,
  scope: ParsedExtraBolaoScopeKey,
): boolean {
  if (row.ticketType !== "extra") return false;

  if (scope.mode === "definition") {
    return row.bolaoDefinitionId === scope.definitionId;
  }

  if (row.extraChampionshipId !== scope.championshipId) return false;

  if (scope.mode === "copa") {
    return (
      row.extraChampionshipId === scope.championshipId &&
      isFullCopaMirrorBolaoCompetition(scope.championshipId)
    );
  }

  if (scope.mode === "skale-daily") {
    return (
      isSkaleDailyBolaoCompetition(scope.championshipId) &&
      row.groupRound === scope.edition
    );
  }

  return row.groupRound === scope.rodada;
}

/** Número de rodada para rótulos admin (0 = copa integral / escopo completo). */
export function extraBolaoScopeRodadaNumber(scope: ParsedExtraBolaoScopeKey): number {
  if (scope.mode === "round") return scope.rodada;
  if (scope.mode === "skale-daily") return scope.edition;
  return 0;
}
