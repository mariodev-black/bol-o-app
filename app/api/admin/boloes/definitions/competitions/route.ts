import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { listAdminCompetitionOptions } from "@/lib/boloes/definitions/branding";
import { listMatchDatesForCompetition, listMatchRoundsForCompetition } from "@/lib/boloes/definitions/repository";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const matchDatesFor = Number(url.searchParams.get("matchDatesFor"));
  const matchRoundsFor = Number(url.searchParams.get("matchRoundsFor"));

  try {
    if (Number.isFinite(matchDatesFor) && matchDatesFor > 0) {
      const dates = await listMatchDatesForCompetition(matchDatesFor);
      return NextResponse.json({ dates });
    }
    if (Number.isFinite(matchRoundsFor) && matchRoundsFor > 0) {
      const rounds = await listMatchRoundsForCompetition(matchRoundsFor);
      return NextResponse.json({ rounds });
    }

    const competitions = await listAdminCompetitionOptions();
    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("[admin/boloes/definitions/competitions] GET", error);
    return NextResponse.json({ error: "Falha ao carregar campeonatos" }, { status: 500 });
  }
}
