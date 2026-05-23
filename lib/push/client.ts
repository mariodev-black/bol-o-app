/** Helpers Web Push no browser — sem imports de servidor. */

export const PUSH_SW_PATH = "/sw.js";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(PUSH_SW_PATH, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
    return null;
  }
}

export async function getPushVapidPublicKey(): Promise<string | null> {
  const r = await fetch("/api/push/vapid", { credentials: "include" });
  if (!r.ok) return null;
  const d = (await r.json()) as { publicKey?: string };
  return d.publicKey?.trim() || null;
}

export async function subscribeBrowserToPush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription | null> {
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  } catch (err) {
    console.warn("[pwa] push subscribe failed", err);
    return null;
  }
}

export async function syncPushSubscriptionToServer(
  subscription: PushSubscription,
): Promise<boolean> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });

  return r.ok;
}

export async function unsubscribeBrowserPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function enablePushNotifications(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!isPushSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission };
  }

  const registration =
    (await navigator.serviceWorker.getRegistration(PUSH_SW_PATH)) ??
    (await registerPwaServiceWorker());
  if (!registration) {
    return { ok: false, reason: "no-sw" };
  }

  await navigator.serviceWorker.ready;

  const publicKey = await getPushVapidPublicKey();
  if (!publicKey) {
    return { ok: false, reason: "no-vapid" };
  }

  const subscription = await subscribeBrowserToPush(registration, publicKey);
  if (!subscription) {
    return { ok: false, reason: "subscribe-failed" };
  }

  const synced = await syncPushSubscriptionToServer(subscription);
  return synced ? { ok: true } : { ok: false, reason: "sync-failed" };
}
