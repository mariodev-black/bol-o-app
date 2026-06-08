/** Fluxo guest na home: palpite antes do cadastro, finalize após login. */

export const HOME_PROMO_FLOW_PATH = "/";

/** @deprecated Use HOME_PROMO_FLOW_PATH */
export const BRASIL_MARROCOS_PROMO_FLOW_PATH = HOME_PROMO_FLOW_PATH;

export const BRASIL_MARROCOS_PENDING_STORAGE_KEY =
  "bolao_brasil_marrocos_pending_palpite";

export const BRASIL_MARROCOS_URL_CASA_KEY = "be_casa";
export const BRASIL_MARROCOS_URL_VIS_KEY = "be_vis";
export const BRASIL_MARROCOS_URL_ESC_KEY = "be_esc";

export const BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL = 3;

/** Guest salvou palpite e ainda não terminou a sequência pós-cadastro. */
export const BRASIL_MARROCOS_GUEST_FLOW_ACTIVE_KEY =
  "bolao_brasil_marrocos_guest_flow_active";

/** Palpite guest já persistido no servidor — não re-finalizar. */
export const BRASIL_MARROCOS_FINALIZED_STORAGE_KEY =
  "bolao_brasil_marrocos_palpite_finalized";

const BRASIL_MARROCOS_REFERRAL_DISMISSED_PREFIX =
  "bolao_brasil_marrocos_referral_modal_dismissed";

export function brasilMarrocosReferralDismissStorageKey(
  userId?: string | null,
): string {
  const id = userId?.trim();
  return id
    ? `${BRASIL_MARROCOS_REFERRAL_DISMISSED_PREFIX}_${id}`
    : BRASIL_MARROCOS_REFERRAL_DISMISSED_PREFIX;
}

export function readBrasilMarrocosReferralModalDismissed(
  userId?: string | null,
): boolean {
  if (!isBrowser()) return false;
  try {
    return (
      localStorage.getItem(brasilMarrocosReferralDismissStorageKey(userId)) === "1"
    );
  } catch {
    return false;
  }
}

export function persistBrasilMarrocosReferralModalDismissed(
  userId?: string | null,
): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(brasilMarrocosReferralDismissStorageKey(userId), "1");
  } catch {
    /* quota / private mode */
  }
}

export type PendingBrasilMarrocosPalpite = {
  predCasa: number;
  predVisitante: number;
  escanteiosBrasil: number;
  savedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeScorePair(
  predCasa: unknown,
  predVisitante: unknown,
  escanteiosBrasil: unknown = 0,
): PendingBrasilMarrocosPalpite | null {
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
  const esc = Number(escanteiosBrasil);
  return {
    predCasa: casa,
    predVisitante: visitante,
    escanteiosBrasil: Number.isFinite(esc) && esc >= 0 && esc <= 99 ? esc : 0,
    savedAt: Date.now(),
  };
}

export function writePendingBrasilMarrocosPalpite(
  predCasa: number,
  predVisitante: number,
  escanteiosBrasil = 0,
): void {
  if (!isBrowser()) return;
  const payload: PendingBrasilMarrocosPalpite = {
    predCasa,
    predVisitante,
    escanteiosBrasil,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(
      BRASIL_MARROCOS_PENDING_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readPendingBrasilMarrocosPalpite(): PendingBrasilMarrocosPalpite | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(BRASIL_MARROCOS_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBrasilMarrocosPalpite>;
    const normalized = normalizeScorePair(parsed.predCasa, parsed.predVisitante, parsed.escanteiosBrasil ?? 0);
    if (!normalized) return null;
    return {
      ...normalized,
      savedAt: Number(parsed.savedAt) || normalized.savedAt,
    };
  } catch {
    return null;
  }
}

export function readPendingBrasilMarrocosFromSearchParams(
  params: URLSearchParams,
): PendingBrasilMarrocosPalpite | null {
  return normalizeScorePair(
    params.get(BRASIL_MARROCOS_URL_CASA_KEY),
    params.get(BRASIL_MARROCOS_URL_VIS_KEY),
    params.get(BRASIL_MARROCOS_URL_ESC_KEY) ?? 0,
  );
}

/** Prioriza sessionStorage; URL é fallback após auth na home. */
export function resolvePendingBrasilMarrocosPalpite(
  params?: URLSearchParams | null,
  userId?: string | null,
): PendingBrasilMarrocosPalpite | null {
  if (isBrasilMarrocosPalpiteFinalized(userId)) return null;
  const fromStorage = readPendingBrasilMarrocosPalpite();
  if (fromStorage) return fromStorage;
  const fromUrl = params ? readPendingBrasilMarrocosFromSearchParams(params) : null;
  if (fromUrl) {
    writePendingBrasilMarrocosPalpite(fromUrl.predCasa, fromUrl.predVisitante);
    return fromUrl;
  }
  return null;
}

export function markBrasilMarrocosPalpiteFinalized(userId?: string | null): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(BRASIL_MARROCOS_FINALIZED_STORAGE_KEY, "1");
    const id = userId?.trim();
    if (id) {
      localStorage.setItem(`${BRASIL_MARROCOS_FINALIZED_STORAGE_KEY}_${id}`, "1");
    }
  } catch {
    /* ignore */
  }
}

export function isBrasilMarrocosPalpiteFinalized(userId?: string | null): boolean {
  if (!isBrowser()) return false;
  try {
    const id = userId?.trim();
    if (id && localStorage.getItem(`${BRASIL_MARROCOS_FINALIZED_STORAGE_KEY}_${id}`) === "1") {
      return true;
    }
    return sessionStorage.getItem(BRASIL_MARROCOS_FINALIZED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearBrasilMarrocosPalpiteFinalized(userId?: string | null): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_MARROCOS_FINALIZED_STORAGE_KEY);
    const id = userId?.trim();
    if (id) {
      localStorage.removeItem(`${BRASIL_MARROCOS_FINALIZED_STORAGE_KEY}_${id}`);
    }
  } catch {
    /* ignore */
  }
}

export function stripBrasilMarrocosPalpiteSearchParams(
  params: URLSearchParams,
): boolean {
  const had =
    params.has(BRASIL_MARROCOS_URL_CASA_KEY) ||
    params.has(BRASIL_MARROCOS_URL_VIS_KEY);
  if (!had) return false;
  params.delete(BRASIL_MARROCOS_URL_CASA_KEY);
  params.delete(BRASIL_MARROCOS_URL_VIS_KEY);
  return true;
}

export function clearPendingBrasilMarrocosPalpite(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_MARROCOS_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function markBrasilMarrocosGuestFlowActive(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(BRASIL_MARROCOS_GUEST_FLOW_ACTIVE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearBrasilMarrocosGuestFlowActive(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(BRASIL_MARROCOS_GUEST_FLOW_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function isBrasilMarrocosGuestFlowActive(): boolean {
  if (!isBrowser()) return false;
  try {
    return sessionStorage.getItem(BRASIL_MARROCOS_GUEST_FLOW_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function buildPromoFlowReturnUrl(
  predCasa: number,
  predVisitante: number,
  escanteiosBrasil = 0,
): string {
  const q = new URLSearchParams({
    [BRASIL_MARROCOS_URL_CASA_KEY]: String(predCasa),
    [BRASIL_MARROCOS_URL_VIS_KEY]: String(predVisitante),
    [BRASIL_MARROCOS_URL_ESC_KEY]: String(escanteiosBrasil),
  });
  return `${HOME_PROMO_FLOW_PATH}?${q.toString()}`;
}

export function stripPromoPalpiteQueryFromPath(pathname: string): string {
  return pathname;
}
