import { NextRequest, NextResponse } from "next/server";
import { findUserById, findUserCreatedAt } from "@/lib/auth/users";
import { responseForDbError } from "@/lib/db-errors";
import { notificationsAuthUserId } from "@/lib/notifications/api-auth";
import {
  countUnreadNotifications,
  ensureBolaoPromoNotification,
  ensureWelcomeNotification,
  listUserNotifications,
  pruneDuplicateNotifications,
} from "@/lib/notifications/user-notifications";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = await notificationsAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const page = Math.max(
    1,
    Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1,
  );
  const perPage = Math.min(
    20,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("perPage") ?? "10", 10) ||
        10,
    ),
  );
  const offset = (page - 1) * perPage;

  try {
    const user = await findUserById(userId);
    if (user) {
      await pruneDuplicateNotifications(userId);
      await ensureWelcomeNotification(userId, user.name);
      const createdAt = await findUserCreatedAt(userId);
      if (createdAt) {
        await ensureBolaoPromoNotification(userId, createdAt, user.name);
      }
      await pruneDuplicateNotifications(userId);
    }

    const [{ items, total }, unreadCount] = await Promise.all([
      listUserNotifications(userId, { limit: perPage, offset }),
      countUnreadNotifications(userId),
    ]);

    const pageCount = Math.max(1, Math.ceil(total / perPage));

    return NextResponse.json({
      items,
      unreadCount,
      page,
      perPage,
      total,
      pageCount,
    });
  } catch (e) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[notifications GET]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[notifications GET]", e);
    return NextResponse.json(
      { error: "Não foi possível carregar as notificações" },
      { status: 500 },
    );
  }
}
