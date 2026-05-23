import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { listAdminBroadcastHistory } from "@/lib/notifications/admin-broadcast";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const items = await listAdminBroadcastHistory(50);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[admin/notifications/history]", e);
    return NextResponse.json(
      { error: "Erro ao carregar historico" },
      { status: 500 },
    );
  }
}
