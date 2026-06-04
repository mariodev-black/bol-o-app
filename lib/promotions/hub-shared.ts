/**
 * Tipos do hub de promoções — seguros para Client Components.
 */

export type PromoHubItemId = "brasil_egito_placar";

export type PromoHubItemState = "active" | "done" | "unavailable";

export type PromoHubCategory = "brindes" | "palpite";

export type PromoHubLeagueRow = {
  displayName: string;
  rodadaNome: string;
  alreadyClaimed: boolean;
};

export type PromoHubItem = {
  id: PromoHubItemId;
  title: string;
  description: string;
  ctaLabel: string;
  state: PromoHubItemState;
  category: PromoHubCategory;
  /** Rótulo curto sobre o card (ex.: AMISTOSO). */
  tag?: string;
  /** Bolões / cotas incluídos na promoção. */
  leagues?: PromoHubLeagueRow[];
  /** Pode abrir o modal / fluxo da promoção. */
  actionable: boolean;
  /** Destaque na lista (ex.: ainda não participou). */
  highlight: boolean;
};

export type PromoHubResponse = {
  items: PromoHubItem[];
  /** Promoções com destaque ativo (badge no ícone de presente). */
  highlightCount: number;
};
