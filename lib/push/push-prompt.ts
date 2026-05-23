/** Preferências compartilhadas: modal pós-PWA e banner de push. */

import { isPushSupported, isStandalonePwa } from "@/lib/push/client";

export const PUSH_PROMPT_DISMISSED_KEY = "bolao_push_prompt_dismissed";
export const PUSH_MODAL_PENDING_SESSION_KEY = "bolao_push_modal_pending";

export const PWA_INSTALLED_EVENT = "bolao:pwa-installed";

const LEGACY_BANNER_DISMISSED_KEY = "bolao_push_banner_dismissed";

export function readPushPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1") return true;
    if (window.localStorage.getItem(LEGACY_BANNER_DISMISSED_KEY) === "1") return true;
    return false;
  } catch {
    return false;
  }
}

export function persistPushPromptDismissed(): void {
  try {
    window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function markPushModalPending(): void {
  try {
    window.sessionStorage.setItem(PUSH_MODAL_PENDING_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readPushModalPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PUSH_MODAL_PENDING_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPushModalPending(): void {
  try {
    window.sessionStorage.removeItem(PUSH_MODAL_PENDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function dispatchPwaInstalled(): void {
  if (typeof window === "undefined") return;
  markPushModalPending();
  window.dispatchEvent(new CustomEvent(PWA_INSTALLED_EVENT));
}

export function canRequestPushInThisContext(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) &&
    !(typeof window !== "undefined" &&
      (window as Window & { MSStream?: unknown }).MSStream);
  if (!isIos) return true;
  return isStandalonePwa();
}

export function shouldOfferPushNotificationsModal(
  ready: boolean,
  isLoggedIn: boolean,
): boolean {
  if (!ready || !isLoggedIn) return false;
  if (!isPushSupported()) return false;
  if (readPushPromptDismissed()) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;

  return isStandalonePwa() || readPushModalPending();
}
