/** Ative com `?debugMainPromo=1` ou `localStorage.setItem('bolao_debug_main_promo','1')`. */
export const PROMO_DEBUG_STORAGE_KEY = "bolao_debug_main_promo";

export function isMainPromoDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(PROMO_DEBUG_STORAGE_KEY) === "1") return true;
    return new URLSearchParams(window.location.search).has("debugMainPromo");
  } catch {
    return false;
  }
}

export function promoDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!isMainPromoDebug()) return;
  if (data) {
    console.info(`[main-bolao-promo] ${message}`, data);
  } else {
    console.info(`[main-bolao-promo] ${message}`);
  }
}
