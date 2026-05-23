import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { searchUsersForAdminNotification } from "@/lib/notifications/admin-broadcast";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const excludeRaw = request.nextUrl.searchParams.get("exclude")?.trim() ?? "";
  const excludeIds = excludeRaw
    ? excludeRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : [];

  try {
    const items = await searchUsersForAdminNotification(q, {
      limit: 20,
      excludeIds,
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[admin/notifications/users]", e);
    return NextResponse.json(
      { error: "Erro ao buscar usuarios" },
      { status: 500 },
    );
  }
}
