/** Tipos e helpers sem dependência de Node/pg — seguros para Client Components. */

export type AdminNotificationUserOption = {
  id: string;
  email: string;
  name: string | null;
};

/** Canais independentes de disparo no admin. */
export type AdminBroadcastChannel = "app" | "push" | "email";

const CHANNEL_ORDER: AdminBroadcastChannel[] = ["app", "push", "email"];

/** Presets legados (API) → canais ativos */
export type AdminDeliveryPreset =
  | "app"
  | "push"
  | "app_push"
  | "email"
  | "all";

export function parseAdminBroadcastChannels(input: {
  channels?: unknown;
  method?: unknown;
}): AdminBroadcastChannel[] {
  if (Array.isArray(input.channels)) {
    const parsed = input.channels
      .map((c) => String(c).trim())
      .filter((c): c is AdminBroadcastChannel =>
        c === "app" || c === "push" || c === "email",
      );
    const unique = [...new Set(parsed)].sort(
      (a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b),
    );
    if (unique.length > 0) return unique;
  }

  const method = String(input.method ?? "app_push").trim();
  switch (method) {
    case "email":
      return ["email"];
    case "push":
    case "pwa":
      return ["push"];
    case "app":
      return ["app"];
    case "both":
      return ["app", "email"];
    case "all":
      return ["app", "push", "email"];
    case "app_push":
    default:
      return ["app", "push"];
  }
}

export function channelsToStorageKey(channels: AdminBroadcastChannel[]): string {
  return [...channels].sort(
    (a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b),
  ).join("+");
}

export function adminDeliveryMethodLabel(channelsKey: string): string {
  const parts = channelsKey.split("+").filter(Boolean);
  const labels: string[] = [];
  if (parts.includes("app")) labels.push("Sininho");
  if (parts.includes("push")) labels.push("Push PWA");
  if (parts.includes("email")) labels.push("E-mail");
  if (labels.length === 0) return channelsKey;
  return labels.join(" + ");
}

export function channelIncludesApp(channels: AdminBroadcastChannel[]) {
  return channels.includes("app");
}

export function channelIncludesPush(channels: AdminBroadcastChannel[]) {
  return channels.includes("push");
}

export function channelIncludesEmail(channels: AdminBroadcastChannel[]) {
  return channels.includes("email");
}

export type AdminBroadcastHistoryItem = {
  batchId: string;
  sentAt: string;
  channels: string;
  title: string;
  preview: string;
  appRecipients: number;
  pushSent: number;
  pushFailed: number;
  emailSent: number;
  emailFailed: number;
  emailQueued: boolean;
};

export type AdminDispatchResult = {
  batchId: string;
  channels: AdminBroadcastChannel[];
  requested: number;
  app: { created: number };
  push: { sent: number; failed: number; expired: number };
  email: { sent: number; failed: number; queued: boolean };
};
