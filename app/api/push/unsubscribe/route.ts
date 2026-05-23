import { NextRequest, NextResponse } from "next/server";
import { notificationsAuthUserId } from "@/lib/notifications/api-auth";
import { deletePushSubscription } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await notificationsAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: string };
    endpoint = String(body.endpoint ?? "").trim();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint obrigatorio" }, { status: 400 });
  }

  try {
    await deletePushSubscription(userId, endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[push/unsubscribe]", e);
    return NextResponse.json({ error: "Erro ao remover" }, { status: 500 });
  }
}
