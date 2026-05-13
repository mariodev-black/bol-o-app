import { NextResponse } from "next/server";
import { readFootballApiCacheJson, standingsCacheKey } from "@/lib/football-api-cache-store";

export const runtime = "nodejs";

function competitionIdNum(): number {
  return Number.parseInt((process.env.FOOTBALL_COMPETITION_ID || "72").trim(), 10) || 72;
}

/** Somente `football_api_cache` no Postgres. Sem API no GET — atualização via cron ou POST interno. */
export async function GET() {
  const compNum = competitionIdNum();
  const key = standingsCacheKey(compNum);
  const payload = await readFootballApiCacheJson(key).catch(() => null);
  if (payload != null) {
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=3600" },
    });
  }

  return NextResponse.json(
    {
      error:
        "Tabela ainda nao carregada. Aplique scripts/sql/add-football-api-cache.sql, configure FOOTBALL_API_TOKEN e rode o cron (GET /api/cron/football-snapshots?secret=... ou warmup do servidor).",
    },
    { status: 503 }
  );
}
