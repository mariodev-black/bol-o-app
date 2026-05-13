import { NextResponse } from "next/server";
import { fetchProviderMatches } from "@/lib/football-api";
import {
  matchCacheRowsTerminalWithoutScores,
  readMatchesCache,
  requestMatchesCacheSoftSync,
  scheduleSaysFresh,
  syncMatchesCache,
} from "@/lib/matches-cache";
import { buildPartidasFasesFromRows } from "@/lib/partidas-cache-payload";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dbg = ["1", "true", "yes"].includes((process.env.DEBUG_MATCHES_SYNC || "").trim().toLowerCase());
    let rows = await readMatchesCache();

    if (rows.length > 0) {
      const placarPendente = matchCacheRowsTerminalWithoutScores(rows);
      if (placarPendente) {
        await syncMatchesCache({ fetchProviderMatches, force: true }).catch(() => {});
        rows = await readMatchesCache();
      } else {
        const podeAdiar = await scheduleSaysFresh().catch(() => false);
        if (!podeAdiar) {
          requestMatchesCacheSoftSync(fetchProviderMatches);
        }
      }
      const partidas = buildPartidasFasesFromRows(rows);
      if (dbg) {
        console.log("[api/partidas] return-cache-fast", {
          count: rows.length,
        });
      }
      return NextResponse.json(
        { partidas },
        {
          headers: {
            "Cache-Control": "private, max-age=120, stale-while-revalidate=600",
          },
        }
      );
    }

    if (rows.length === 0) {
      await syncMatchesCache({ fetchProviderMatches, force: true });
      rows = await readMatchesCache();
      if (dbg) console.log("[api/partidas] forced-sync-on-empty-cache", { currentCount: rows.length });
    }
    const partidas = buildPartidasFasesFromRows(rows);
    if (dbg) {
      const phases = new Set(rows.map((r) => r.phase_key || "geral"));
      const withDate = rows.filter((r) => String(r.date_br || "").trim() !== "").length;
      const withHour = rows.filter((r) => /^\d{2}:\d{2}$/.test(String(r.hour_br || "").slice(0, 5))).length;
      const sample = rows.slice(0, 5).map((r) => ({
        match_id: r.match_id,
        phase: r.phase_key,
        round: r.round_key,
        status: r.status,
        date_br: r.date_br,
        hour_br: r.hour_br,
        kickoff_at: r.kickoff_at,
      }));
      console.log("[api/partidas] stable-rows", {
        count: rows.length,
        phases: Array.from(phases),
        withDate,
        withoutDate: rows.length - withDate,
        withHour,
        withoutHour: rows.length - withHour,
        sample,
      });
    }

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
