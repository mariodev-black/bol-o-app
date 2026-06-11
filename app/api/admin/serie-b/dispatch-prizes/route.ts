import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  creditSerieBTop3Prizes,
  resolveSerieBTopWinners,
  SERIE_B_PRIZE_AMOUNTS_BRL,
} from "@/lib/boloes/serie-b-prize-dispatch";

export const runtime = "nodejs";

function parseRodada(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("rodada");
  const n = Number.parseInt(raw ?? "12", 10);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const rodada = parseRodada(request);
  const winners = await resolveSerieBTopWinners(rodada, 3);
  return NextResponse.json({
    rodada,
    prizes: SERIE_B_PRIZE_AMOUNTS_BRL,
    winners: winners.map((w) => ({
      ...w,
      prizeLabel: SERIE_B_PRIZE_AMOUNTS_BRL[w.position],
    })),
  });
}

type Body = {
  rodada?: number;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let payload: Body = {};
  try {
    payload = (await request.json()) as Body;
  } catch {
    payload = {};
  }

  const rodada =
    payload.rodada != null && Number.isFinite(Number(payload.rodada)) && Number(payload.rodada) > 0
      ? Math.trunc(Number(payload.rodada))
      : parseRodada(request);

  const winners = await resolveSerieBTopWinners(rodada, 3);
  if (winners.length === 0) {
    return NextResponse.json(
      { error: "Nenhum ganhador no ranking da Serie B para esta rodada." },
      { status: 400 },
    );
  }

  const result = await creditSerieBTop3Prizes({
    rodada,
    dryRun: payload.dryRun === true,
  });

  return NextResponse.json({
    ok: true,
    prizes: SERIE_B_PRIZE_AMOUNTS_BRL,
    ...result,
  });
}
