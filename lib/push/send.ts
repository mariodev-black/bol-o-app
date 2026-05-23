import webpush from "web-push";
import { getAppOrigin } from "@/lib/seo/config";
import { ensureWebPushVapid, isWebPushConfigured } from "@/lib/push/config";
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUsers,
} from "@/lib/push/subscriptions";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  notificationId?: string;
};

function resolvePushUrl(path?: string): string {
  const origin = getAppOrigin();
  if (!path || path === "/") return `${origin}/palpites`;
  if (path.startsWith("http")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendPushToUserIds(input: {
  userIds: string[];
  payload: PushPayload;
}): Promise<{ sent: number; failed: number; expired: number }> {
  if (!isWebPushConfigured() || !ensureWebPushVapid()) {
    return { sent: 0, failed: 0, expired: 0 };
  }

  const uniqueIds = [...new Set(input.userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { sent: 0, failed: 0, expired: 0 };
  }

  const subscriptions = await listPushSubscriptionsForUsers(uniqueIds);
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, expired: 0 };
  }

  const json = JSON.stringify({
    title: input.payload.title,
    body: input.payload.body,
    url: resolvePushUrl(input.payload.url),
    tag: input.payload.tag,
    notificationId: input.payload.notificationId,
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
  });

  let sent = 0;
  let failed = 0;
  let expired = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await deletePushSubscriptionByEndpoint(sub.endpoint);
          expired += 1;
        } else {
          failed += 1;
          console.warn("[push] send failed", {
            endpoint: sub.endpoint.slice(0, 48),
            status,
          });
        }
      }
    }),
  );

  return { sent, failed, expired };
}
