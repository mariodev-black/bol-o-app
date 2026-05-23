import { NextRequest, NextResponse } from "next/server";
import { notificationsAuthUserId } from "@/lib/notifications/api-auth";
import { isWebPushConfigured } from "@/lib/push/config";
import { upsertPushSubscription } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: NextRequest) {
  const userId = await notificationsAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Push nao configurado no servidor" },
      { status: 503 },
    );
  }

  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const endpoint = String(payload.endpoint ?? "").trim();
  const p256dh = String(payload.keys?.p256dh ?? "").trim();
  const auth = String(payload.keys?.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Subscription incompleta" },
      { status: 400 },
    );
  }

  try {
    await upsertPushSubscription({
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/subscribe]", e);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
