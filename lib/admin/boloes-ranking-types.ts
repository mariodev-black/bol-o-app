/** Tipos e constantes do ranking admin — seguros para Client Components (sem pg/db). */

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

export function parseExtraBolaoScopeKey(
  key: string,
): { championshipId: number; rodada: number } | null {
  const match = /^(\d+):r(\d+)$/.exec(key.trim());
  if (!match) return null;
  const championshipId = Number(match[1]);
  const rodada = Number(match[2]);
  if (!Number.isFinite(championshipId) || !Number.isFinite(rodada) || rodada < 1) return null;
  return { championshipId, rodada };
}
