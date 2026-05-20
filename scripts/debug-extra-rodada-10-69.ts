/**
 * Compara rodada exibida (cache/API) vs rodada inferida dos jogos (playable date).
 * Uso: npx tsx scripts/debug-extra-rodada-10-69.ts
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { resolveDiarioPlayableDate, brToday } from "@/lib/diario-playable-date";
import { fetchMatchesMap } from "@/lib/football-api";
import { fetchChampionshipSnapshot } from "@/lib/football/provider";
import { readChampionshipSnapshot } from "@/lib/football/persistence";
import { resolveCurrentExtraRound } from "@/lib/football/extras-rodada";
import type { MatchMap } from "@/lib/match-map-types";

const IDS = [10, 69];

function inferRodadaFromPlayableDate(matches: MatchMap, competitionId: number) {
  const playable = resolveDiarioPlayableDate(matches, { competitionId });
  const today = brToday();
  const onPlayable: Array<{ id: number; rodada: number | null; status: string; dateBR: string }> = [];
  const byRodada = new Map<number, number>();
  const openByRodada = new Map<number, number>();

  for (const [key, m] of matches) {
    if (Number(m.competitionId) !== competitionId) continue;
    if (m.dateBR !== playable) continue;
    const r = m.rodada ?? null;
    onPlayable.push({
      id: m.id,
      rodada: r,
      status: m.status,
      dateBR: m.dateBR,
    });
    if (r != null && r > 0) {
      byRodada.set(r, (byRodada.get(r) ?? 0) + 1);
      const s = String(m.status || "").toLowerCase();
      if (!s.includes("encerr") && !s.includes("final")) {
        openByRodada.set(r, (openByRodada.get(r) ?? 0) + 1);
      }
    }
  }

  const rodadas = [...byRodada.keys()].sort((a, b) => a - b);
  const maxRodada = rodadas.length ? Math.max(...rodadas) : null;
  const maxOpenRodada = openByRodada.size
    ? Math.max(...openByRodada.keys())
    : null;

  return {
    today,
    playableDate: playable,
    gamesOnPlayable: onPlayable.length,
    rodadaCountsOnPlayable: Object.fromEntries(byRodada),
    maxRodadaOnPlayable: maxRodada,
    maxOpenRodadaOnPlayable: maxOpenRodada,
    sample: onPlayable.slice(0, 4),
  };
}

async function main() {
  const matches = await fetchMatchesMap({ ensureCompetitionIds: IDS });

  console.log("\n=== Extra rodada debug (10 Brasileirão vs 69 Premier) ===\n");

  for (const id of IDS) {
    const cached = await readChampionshipSnapshot(id);
    const resolvedCacheOnly = await resolveCurrentExtraRound(id, {
      allowProviderCall: false,
    });
    const resolved = await resolveCurrentExtraRound(id);
    let apiRodada: number | null = null;
    try {
      const snap = await fetchChampionshipSnapshot(id);
      apiRodada = snap.rodadaAtual?.numero ?? null;
    } catch (e) {
      console.warn(`API snapshot ${id} failed:`, e);
    }

    const inferred = inferRodadaFromPlayableDate(matches, id);

    console.log(`--- competition_id=${id} ---`);
    console.log({
      championships_cache: cached
        ? {
            nome: cached.nome,
            rodada_atual_numero: cached.rodada_atual_numero,
            rodada_atual_nome: cached.rodada_atual_nome,
            rodada_atual_status: cached.rodada_atual_status,
            fetched_at: cached.fetched_at,
          }
        : null,
      resolveCurrentExtraRound_cacheOnly: resolvedCacheOnly
        ? {
            rodada: resolvedCacheOnly.rodada,
            rodadaNome: resolvedCacheOnly.rodadaNome,
            status: resolvedCacheOnly.rodadaStatus,
          }
        : null,
      resolveCurrentExtraRound_withAdvance: resolved
        ? { rodada: resolved.rodada, rodadaNome: resolved.rodadaNome, status: resolved.rodadaStatus }
        : null,
      api_futebol_rodada_atual: apiRodada,
      from_matches_playable_date: inferred,
      mismatch:
        resolved && inferred.maxRodadaOnPlayable != null
          ? resolved.rodada !== inferred.maxRodadaOnPlayable
          : null,
    });
    // Todas as rodadas/datas no cache
    const byDate = new Map<string, { rodada: number | null; count: number }>();
    const byRodada = new Map<number, { dates: Set<string>; count: number }>();
    for (const m of matches.values()) {
      if (Number(m.competitionId) !== id) continue;
      const d = m.dateBR || "?";
      const prev = byDate.get(d);
      byDate.set(d, {
        rodada: m.rodada ?? prev?.rodada ?? null,
        count: (prev?.count ?? 0) + 1,
      });
      const r = m.rodada;
      if (r != null && r > 0) {
        const br = byRodada.get(r) ?? { dates: new Set<string>(), count: 0 };
        br.dates.add(d);
        br.count += 1;
        byRodada.set(r, br);
      }
    }
    const datesSorted = [...byDate.entries()].sort(
      (a, b) =>
        (Date.parse(a[0].split("/").reverse().join("-")) || 0) -
        (Date.parse(b[0].split("/").reverse().join("-")) || 0),
    );
    console.log("matches_cache summary:", {
      distinctDates: datesSorted.length,
      lastDates: datesSorted.slice(-6),
      rodadas: [...byRodada.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([r, v]) => ({
          rodada: r,
          count: v.count,
          dates: [...v.dates].sort(),
        })),
      maxRodadaInCache: byRodada.size ? Math.max(...byRodada.keys()) : null,
    });
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
