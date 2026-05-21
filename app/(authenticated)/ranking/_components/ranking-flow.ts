import type { RankingScopeOption } from "@/lib/ranking/scopes-shared";

/** Mesma ordem e tom do card “Como funciona?” em Meus Bolões. */
export const RANKING_PALPITES_STEPS = [
  "Clique em \u201CFazer palpites\u201D",
  "Preencha o placar de cada jogo",
  "Acompanhe sua posição no ranking",
] as const;

export type RankingScopeCardAction = "ranking" | "palpites";

export function getScopeCardAction(
  scope: RankingScopeOption,
): RankingScopeCardAction {
  if (scope.status === "aguardando") return "palpites";
  return "ranking";
}
