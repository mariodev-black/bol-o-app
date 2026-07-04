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

/**
 * As rotinas de "garantir/limpar" notificações (welcome, promo, prune de
 * duplicadas) fazem várias escritas no banco. O feed é pollado com frequência,
 * então rodar isso em toda requisição saturava o pool de conexões e deixava a
 * app inteira lenta. Passamos a rodar essas rotinas no máximo uma vez a cada
 * `MAINTENANCE_TTL_MS` por usuário (em memória, por processo Node).
 */
const MAINTENANCE_TTL_MS = 5 * 60 * 1000;
declare global {
  // eslint-disable-next-line no-var
  var __notifMaintenanceAt: Map<string, number> | undefined;
}
function shouldRunMaintenance(userId: string): boolean {
  const store = (globalThis.__notifMaintenanceAt ??= new Map<string, number>());
  const last = store.get(userId) ?? 0;
  const now = Date.now();
  if (now - last < MAINTENANCE_TTL_MS) return false;
  store.set(userId, now);
  return true;
}

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
    if (shouldRunMaintenance(userId)) {
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
