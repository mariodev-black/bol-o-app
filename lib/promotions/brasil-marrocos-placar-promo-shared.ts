/** Tipos e helpers puros da promo Brasil x Marrocos (sem DB — safe para client). */

export const PROMO_ACTIVATION_PATH = "/promo-camisa-brasil";
export const PROMO_CHECKOUT_PATH = "/comprar-cotas";
export const PROMO_CHECKOUT_PATHS = [
  PROMO_CHECKOUT_PATH,
  "/tickets/obrigado",
] as const;

export function isPromoCheckoutPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PROMO_CHECKOUT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Palpite salvo e cota promocional ainda não paga. */
export function mustCompletePromoQuotaPurchase(
  status: Pick<
    BrasilMarrocosPlacarPromoStatus,
    "needsQuotaPurchase" | "alreadySubmitted" | "promoActivated"
  >,
): boolean {
  return (
    status.needsQuotaPurchase ||
    (status.alreadySubmitted && !status.promoActivated)
  );
}

export type BrasilMarrocosPlacarPromoStatus = {
  enabled: boolean;
  showOfferModal: boolean;
  hasBet: boolean;
  alreadySubmitted: boolean;
  /** Cota paga — promo ativada após PIX aprovado. */
  promoActivated: boolean;
  /** Palpite salvo, mas ainda falta comprar a cota. */
  needsQuotaPurchase: boolean;
  referralCode: string;
  signupLink: string;
  friendsInvited: number;
  friendsGoal: number;
  predCasa: number | null;
  predVisitante: number | null;
  escanteiosBrasil: number | null;
};

/** 0x0 é o default do modal — não conta como palpite enviado. */
export function isMeaningfulBrasilMarrocosPlacarSubmission(
  predCasa: number,
  predVisitante: number,
): boolean {
  return !(predCasa === 0 && predVisitante === 0);
}
