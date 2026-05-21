import { NextRequest, NextResponse } from "next/server";
import { responseForDbError } from "@/lib/db-errors";
import { notificationsAuthUserId } from "@/lib/notifications/api-auth";
import { markNotificationRead } from "@/lib/notifications/user-notifications";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const userId = await notificationsAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const item = await markNotificationRead(userId, id.trim());
    if (!item) {
      return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (e) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[notifications read]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[notifications read]", e);
    return NextResponse.json(
      { error: "Não foi possível marcar como lida" },
      { status: 500 },
    );
  }
}
