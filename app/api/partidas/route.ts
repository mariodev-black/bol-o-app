import { NextResponse } from "next/server";
import { readMatchesCache } from "@/lib/matches-cache";
import { buildPartidasFasesFromRows } from "@/lib/partidas-cache-payload";

export const runtime = "nodejs";

/**
 * Somente Postgres (`matches_cache`). Não chama API Futebol — preenchimento via cron / bootstrap / rotas /cron/*.
 */
export async function GET() {
  try {
    const rows = await readMatchesCache();
    const partidas = buildPartidasFasesFromRows(rows);
    return NextResponse.json(
      { partidas },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar partidas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
