import webpush from "web-push";

export function getVapidPublicKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function getVapidPrivateKey(): string | null {
  const key = process.env.VAPID_PRIVATE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function getVapidSubject(): string {
  const raw = process.env.VAPID_SUBJECT?.trim();
  if (raw && raw.length > 0) return raw;
  const reply = process.env.EMAIL_REPLY_TO?.trim();
  if (reply && reply.length > 0) {
    return reply.startsWith("mailto:") ? reply : `mailto:${reply}`;
  }
  return "mailto:contato@bolaodomilhao.com.br";
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

let vapidConfigured = false;

export function ensureWebPushVapid(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}
