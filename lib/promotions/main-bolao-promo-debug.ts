/** Ative com `?debugMainPromo=1` na URL. */
export function isMainPromoDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
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
