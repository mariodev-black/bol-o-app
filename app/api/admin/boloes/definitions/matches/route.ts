import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { listMatchesForAdminPicker } from "@/lib/boloes/definitions/repository";

export const dynamic = "force-dynamic";

/** Lista jogos para o seletor do admin (multi-campeonato). */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("competitionIds") ?? "";
    const competitionIds = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    const dateBR = url.searchParams.get("dateBR");
    const roundNumber = url.searchParams.get("roundNumber");
    const limit = Number(url.searchParams.get("limit") ?? 200);

    const matches = await listMatchesForAdminPicker({
      competitionIds,
      dateBR,
      roundNumber: roundNumber ? Number(roundNumber) : null,
      limit,
    });
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("[admin/boloes/definitions/matches] GET", error);
    const msg = error instanceof Error ? error.message : "Falha ao listar jogos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
