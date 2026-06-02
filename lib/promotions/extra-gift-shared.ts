/**
 * Tipos e constantes do brinde extra — seguros para Client Components.
 * Lógica de servidor fica em `extra-gift.ts`.
 */

/** Versão da campanha (muda resgate e dismiss no cliente). */
export const EXTRA_GIFT_PROMO_CAMPAIGN_ID = "extra_gift_v2";

export type ExtraGiftLeagueKind =
  | "brasileirao"
  | "serie_b"
  | "amistosos"
  | "premier_league"
  | "libertadores"
  | "other";
