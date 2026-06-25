import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  creditAndNotifyDailyEditionPrizes,
  creditDailyEditionTop10Prizes,
  resolveDailyEditionTopWinners,
} from "@/lib/boloes/daily-edition-prize-dispatch";
import { calculateDailyPrizePoolCents, calculatePrizeAwards } from "@/lib/prizes/distribution";
import {
  parseAdminBroadcastChannels,
  type AdminBroadcastChannel,
} from "@/lib/notifications/admin-broadcast-shared";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ edition: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { edition } = await context.params;
  const editionNumber = Number.parseInt(edition, 10);
  if (!Number.isFinite(editionNumber) || editionNumber < 1) {
    return NextResponse.json({ error: "Edicao invalida" }, { status: 400 });
  }

  const { winners, totalRevenueCents, ticketsCount } =
    await resolveDailyEditionTopWinners(editionNumber, 10);
  const poolCents = calculateDailyPrizePoolCents(totalRevenueCents);
  const awards = calculatePrizeAwards(poolCents, winners.length, "daily");

  return NextResponse.json({
    editionNumber,
    ticketsCount,
    totalRevenueCents,
    poolCents,
    preview: awards.map((a) => {
      const row = winners[a.rank - 1];
      return {
        position: a.rank,
        userId: row?.userId,
        displayName: row?.displayName,
        totalPoints: row?.totalPoints,
        amountCents: a.amountCents,
      };
    }),
  });
}

type Body = {
  channels?: string[];
  dryRun?: boolean;
  notify?: boolean;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ edition: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { edition } = await context.params;
  const editionNumber = Number.parseInt(edition, 10);
  if (!Number.isFinite(editionNumber) || editionNumber < 1) {
    return NextResponse.json({ error: "Edicao invalida" }, { status: 400 });
  }

  let payload: Body = {};
  try {
    payload = (await request.json()) as Body;
  } catch {
    payload = {};
  }

  const channels: AdminBroadcastChannel[] =
    parseAdminBroadcastChannels(payload).length > 0
      ? parseAdminBroadcastChannels(payload)
      : (["app", "push"] as AdminBroadcastChannel[]);

  if (payload.dryRun) {
    const credit = await creditDailyEditionTop10Prizes({
      editionNumber,
      dryRun: true,
    });
    return NextResponse.json({ ok: true, dryRun: true, credit });
  }

  const result = await creditAndNotifyDailyEditionPrizes({
    editionNumber,
    notify: payload.notify !== false,
    channels,
  });

  return NextResponse.json({ ok: true, ...result });
}
