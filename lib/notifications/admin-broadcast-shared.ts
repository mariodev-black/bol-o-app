/** Tipos e helpers sem dependência de Node/pg — seguros para Client Components. */

export type AdminNotificationUserOption = {
  id: string;
  email: string;
  name: string | null;
};

export type AdminBroadcastChannel = "app" | "email";

export type AdminDeliveryMethod = "app" | "email" | "both";

export function parseAdminDeliveryMethod(
  method: unknown,
): AdminBroadcastChannel[] {
  if (method === "email") return ["email"];
  if (method === "both") return ["app", "email"];
  return ["app"];
}

export function adminDeliveryMethodLabel(channels: string): string {
  if (channels === "app+email" || channels === "both") return "App + E-mail";
  if (channels === "email") return "E-mail";
  return "App";
}

export type AdminBroadcastHistoryItem = {
  batchId: string;
  sentAt: string;
  channels: string;
  title: string;
  preview: string;
  appRecipients: number;
  emailSent: number;
  emailFailed: number;
  emailQueued: boolean;
};
