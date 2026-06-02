import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  listAmistososAdminMatches,
  setAmistososMatchResult,
} from "@/lib/football/amistosos-friendlies-persistence";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const matches = await listAmistososAdminMatches();
  return NextResponse.json({ matches });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    matchId?: number;
    resultCasa?: number;
    resultVisitante?: number;
  };

  const matchId = Number(body.matchId);
  const resultCasa = Number(body.resultCasa);
  const resultVisitante = Number(body.resultVisitante);

  if (!Number.isFinite(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "matchId inválido." }, { status: 400 });
  }

  const result = await setAmistososMatchResult(matchId, resultCasa, resultVisitante);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const matches = await listAmistososAdminMatches();
  return NextResponse.json({ ok: true, matches });
}
