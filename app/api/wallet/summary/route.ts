import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { getWalletAggregates, listWalletEntries } from "@/lib/wallet/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before");

  try {
    const [aggregates, entries] = await Promise.all([
      getWalletAggregates(userId),
      // Busca 1 a mais para saber se há próxima página.
      listWalletEntries(userId, { limit: PAGE_SIZE + 1, before }),
    ]);

    const hasMore = entries.length > PAGE_SIZE;
    const page = hasMore ? entries.slice(0, PAGE_SIZE) : entries;
    const nextBefore = hasMore ? page[page.length - 1]?.createdAt ?? null : null;

    return NextResponse.json({ ...aggregates, entries: page, hasMore, nextBefore });
  } catch (e) {
    console.error("[wallet/summary]", e);
    return NextResponse.json({ error: "Falha ao carregar a carteira" }, { status: 500 });
  }
}
