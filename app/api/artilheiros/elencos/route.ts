import { NextRequest, NextResponse } from "next/server";
import {
  getElencosMeta,
  listArtilheiroPlayersByTeam,
  listArtilheiroTeams,
  searchArtilheiroPlayers,
  searchArtilheiroTeams,
} from "@/lib/artilheiros/elencos";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const teamId = Number(request.nextUrl.searchParams.get("teamId"));
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (Number.isFinite(teamId) && teamId > 0) {
    const players = q
      ? searchArtilheiroPlayers(teamId, q)
      : listArtilheiroPlayersByTeam(teamId);
    return NextResponse.json({ players });
  }

  const teams = q ? searchArtilheiroTeams(q) : listArtilheiroTeams();
  return NextResponse.json({ meta: getElencosMeta(), teams });
}