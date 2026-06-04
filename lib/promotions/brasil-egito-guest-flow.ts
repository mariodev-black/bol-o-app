/** Fluxo guest na home: palpite antes do cadastro, finalize após login. */

export const HOME_PROMO_FLOW_PATH = "/";

/** @deprecated Use HOME_PROMO_FLOW_PATH */
export const BRASIL_EGITO_PROMO_FLOW_PATH = HOME_PROMO_FLOW_PATH;

export const BRASIL_EGITO_PENDING_STORAGE_KEY =
  "bolao_brasil_egito_pending_palpite";

export const BRASIL_EGITO_URL_CASA_KEY = "be_casa";
export const BRASIL_EGITO_URL_VIS_KEY = "be_vis";

export const BRASIL_EGITO_PLACAR_FRIENDS_GOAL = 3;

/** Guest salvou palpite e ainda não terminou a sequência pós-cadastro. */
export const BRASIL_EGITO_GUEST_FLOW_ACTIVE_KEY =
  "bolao_brasil_egito_guest_flow_active";

/** Palpite guest já persistido no servidor — não re-finalizar. */
export const BRASIL_EGITO_FINALIZED_STORAGE_KEY =
  "bolao_brasil_egito_palpite_finalized";

const BRASIL_EGITO_REFERRAL_DISMISSED_PREFIX =
  "bolao_brasil_egito_referral_modal_dismissed";

export function brasilEgitoReferralDismissStorageKey(
  userId?: string | null,
): string {
  const id = userId?.trim();
  return id
    ? `${BRASIL_EGITO_REFERRAL_DISMISSED_PREFIX}_${id}`
    : BRASIL_EGITO_REFERRAL_DISMISSED_PREFIX;
}

export function readBrasilEgitoReferralModalDismissed(
  userId?: string | null,
): boolean {
  if (!isBrowser()) return false;
  try {
    return (
      localStorage.getItem(brasilEgitoReferralDismissStorageKey(userId)) === "1"
    );
  } catch {
    return false;
  }
}

export function persistBrasilEgitoReferralModalDismissed(
  userId?: string | null,
): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(brasilEgitoReferralDismissStorageKey(userId), "1");
  } catch {
    /* quota / private mode */
  }
}

export type PendingBrasilEgitoPalpite = {
  predCasa: number;
  predVisitante: number;
  savedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeScorePair(
  predCasa: unknown,
  predVisitante: unknown,
): PendingBrasilEgitoPalpite | null {
  const casa = Number(predCasa);
  const visitante = Number(predVisitante);
  if (
    !Number.isFinite(casa) ||
    !Number.isFinite(visitante) ||
    casa < 0 ||
    visitante < 0 ||
    casa > 99 ||
    visitante > 99
  ) {
    return null;
  }
  return { predCasa: casa, predVisitante: visitante, savedAt: Date.now() };
}

export function writePendingBrasilEgitoPalpite(
  predCasa: number,
  predVisitante: number,
): void {
  if (!isBrowser()) return;
  const payload: PendingBrasilEgitoPalpite = {
    predCasa,
    predVisitante,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(
      BRASIL_EGITO_PENDING_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readPendingBrasilEgitoPalpite(): PendingBrasilEgitoPalpite | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(BRASIL_EGITO_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBrasilEgitoPalpite>;
    const normalized = normalizeScorePair(parsed.predCasa, parsed.predVisitante);
    if (!normalized) return null;
    return {
      ...normalized,
      savedAt: Number(parsed.savedAt) || normalized.savedAt,
    };
  } catch {
    return null;
  }
}

export function readPendingBrasilEgitoFromSearchParams(
  params: URLSearchParams,
): PendingBrasilEgitoPalpite | null {
  return normalizeScorePair(
    params.get(BRASIL_EGITO_URL_CASA_KEY),
    params.get(BRASIL_EGITO_URL_VIS_KEY),
  );
}

/** Prioriza sessionStorage; URL é fallback após auth na home. */
export function resolvePendingBrasilEgitoPalpite(
  params?: URLSearchParams | null,
  userId?: string | null,
): PendingBrasilEgitoPalpite | null {
  if (isBrasilEgitoPalpiteFinalized(userId)) return null;
  const fromStorage = readPendingBrasilEgitoPalpite();
  if (fromStorage) return fromStorage;
  const fromUrl = params ? readPendingBrasilEgitoFromSearchParams(params) : null;
  if (fromUrl) {
    writePendingBrasilEgitoPalpite(fromUrl.predCasa, fromUrl.predVisitante);
    return fromUrl;
  }
  return null;
}

export function markBrasilEgitoPalpiteFinalized(userId?: string | null): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(BRASIL_EGITO_FINALIZED_STORAGE_KEY, "1");
    const id = userId?.trim();
    if (id) {
      localStorage.setItem(`${BRASIL_EGITO_FINALIZED_STORAGE_KEY}_${id}`, "1");
    }
  } catch {
    /* ignore */
  }
}

export function isBrasilEgitoPalpiteFinalized(userId?: string | null): boolean {
  if (!isBrowser()) return false;
  try {
    const id = userId?.trim();
    if (id && localStorage.getItem(`${BRASIL_EGITO_FINALIZED_STORAGE_KEY}_${id}`) === "1") {
      return true;
    }
    return sessionStorage.getItem(BRASIL_EGITO_FINALIZED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearBrasilEgitoPalpiteFinalized(userId?: string | null): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_EGITO_FINALIZED_STORAGE_KEY);
    const id = userId?.trim();
    if (id) {
      localStorage.removeItem(`${BRASIL_EGITO_FINALIZED_STORAGE_KEY}_${id}`);
    }
  } catch {
    /* ignore */
  }
}

export function stripBrasilEgitoPalpiteSearchParams(
  params: URLSearchParams,
): boolean {
  const had =
    params.has(BRASIL_EGITO_URL_CASA_KEY) ||
    params.has(BRASIL_EGITO_URL_VIS_KEY);
  if (!had) return false;
  params.delete(BRASIL_EGITO_URL_CASA_KEY);
  params.delete(BRASIL_EGITO_URL_VIS_KEY);
  return true;
}

export function clearPendingBrasilEgitoPalpite(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_EGITO_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function markBrasilEgitoGuestFlowActive(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(BRASIL_EGITO_GUEST_FLOW_ACTIVE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearBrasilEgitoGuestFlowActive(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_EGITO_GUEST_FLOW_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function isBrasilEgitoGuestFlowActive(): boolean {
  if (!isBrowser()) return false;
  try {
    return sessionStorage.getItem(BRASIL_EGITO_GUEST_FLOW_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function buildPromoFlowReturnUrl(
  predCasa: number,
  predVisitante: number,
): string {
  const q = new URLSearchParams({
    [BRASIL_EGITO_URL_CASA_KEY]: String(predCasa),
    [BRASIL_EGITO_URL_VIS_KEY]: String(predVisitante),
  });
  return `${HOME_PROMO_FLOW_PATH}?${q.toString()}`;
}

export function stripPromoPalpiteQueryFromPath(pathname: string): string {
  return pathname;
}
