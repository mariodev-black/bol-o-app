import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { listBolaoDefinitionsWithStats } from "@/lib/boloes/definitions/stats";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const items = await listBolaoDefinitionsWithStats({ includeDisabled: true });
    const active = items.filter((i) => i.enabled && i.saleEnabled);
    const overview = {
      totalDefinitions: items.length,
      activeForSale: active.length,
      totalTicketsPaid: items.reduce((s, i) => s + i.ticketsPaid, 0),
      totalRevenueCents: items.reduce((s, i) => s + i.revenueCents, 0),
      totalParticipants: items.reduce((s, i) => s + i.participants, 0),
    };
    return NextResponse.json({ overview, items });
  } catch (error) {
    console.error("[admin/boloes/definitions/overview] GET", error);
    return NextResponse.json({ error: "Falha ao carregar resumo" }, { status: 500 });
  }
}
