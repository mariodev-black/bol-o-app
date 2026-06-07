import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  AMISTOSOS_PRIZE_AMOUNTS_BRL,
  dispatchAmistososPrizeNotifications,
  resolveAmistososTopWinners,
} from "@/lib/boloes/amistosos-prize-dispatch";
import {
  parseAdminBroadcastChannels,
  type AdminBroadcastChannel,
} from "@/lib/notifications/admin-broadcast-shared";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const winners = await resolveAmistososTopWinners(3);
  return NextResponse.json({
    prizes: AMISTOSOS_PRIZE_AMOUNTS_BRL,
    winners: winners.map((w) => ({
      ...w,
      prizeLabel: AMISTOSOS_PRIZE_AMOUNTS_BRL[w.position],
    })),
  });
}

type Body = {
  channels?: string[];
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

  const channels: AdminBroadcastChannel[] =
    parseAdminBroadcastChannels(payload).length > 0
      ? parseAdminBroadcastChannels(payload)
      : (["email", "app", "push"] as AdminBroadcastChannel[]);

  const winners = await resolveAmistososTopWinners(3);
  if (winners.length === 0) {
    return NextResponse.json(
      { error: "Nenhum ganhador no ranking dos amistosos." },
      { status: 400 },
    );
  }

  const result = await dispatchAmistososPrizeNotifications({
    winners,
    channels,
    dryRun: payload.dryRun === true,
  });

  return NextResponse.json({
    ok: true,
    dryRun: payload.dryRun === true,
    prizes: AMISTOSOS_PRIZE_AMOUNTS_BRL,
    ...result,
  });
}
