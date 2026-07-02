import { NextResponse } from "next/server";
import { buildAdminBolaoHubItems } from "@/lib/admin/bolao-hub-items";
import { requireAdminApi } from "@/lib/admin/require-admin-api";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const items = await buildAdminBolaoHubItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[admin/boloes/hub] GET", error);
    return NextResponse.json({ error: "Falha ao carregar bolões" }, { status: 500 });
  }
}
