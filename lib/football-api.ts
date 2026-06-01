/**
 * Camada de LEITURA das partidas (Postgres `matches_cache`).
 *
 * Toda a escrita/coleta da API Futebol vive em `lib/football/` (provider +
 * persistence + orquestrador + realtime worker + scheduler). Esta camada existe
 * apenas para os consumidores que precisam de um `MatchMap` pronto para uso em
 * SSR/SSG/components.
 */

import { getAllSyncedCompetitionIds, getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { registerMatchMapMemoryInvalidate } from "@/lib/match-map-cache-invalidator";
import { parseKickoffFromPartidaPayload } from "@/lib/partida-placar";
import { readMatchesCache } from "@/lib/matches-cache";
import { resolveOfficialMatchResults } from "@/lib/palpites-match-open";
import type { MatchMap } from "@/lib/match-map-types";
import { matchMapKey } from "@/lib/match-map-types";

export type { MatchMap, MatchMapEntry } from "@/lib/match-map-types";
export { getMatchFromMap, matchMapKey } from "@/lib/match-map-types";

/** Mapa em memoria: evita reler o DB a cada request. Invalidado pelo persist v2. */
const MATCH_MAP_MEMORY_TTL_MS =
  Number.parseInt(process.env.MATCH_MAP_MEMORY_TTL_MS ?? `${3 * 60 * 1000}`, 10) || 3 * 60 * 1000;

let matchMapMemoryCache: { at: number; map: MatchMap; scopeKey: string } | null = null;

registerMatchMapMemoryInvalidate(() => {
  matchMapMemoryCache = null;
});

export function resolveKickoffAtIso(match: {
  kickoffAt: string | null;
  dateBR: string;
  hour: string;
}): string | null {
  const k = match.kickoffAt?.trim();
  if (k) return match.kickoffAt;
  return parseKickoffFromPartidaPayload({
    data_realizacao: match.dateBR,
    hora_realizacao: match.hour,
  });
}

function mergeCompetitionIdsForMatchMap(ensureCompetitionIds?: number[]): {
  scopeIds: number[];
  scopeKey: string;
} {
  const base = getAllSyncedCompetitionIds();
  const extra = (ensureCompetitionIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const scopeIds = [...new Set([...base, ...extra])];
  const scopeKey = scopeIds
    .slice()
    .sort((a, b) => a - b)
    .join(",");
  return { scopeIds, scopeKey };
}

function dateBrHourFromCacheRow(r: {
  date_br: string | null;
  hour_br: string | null;
  kickoff_at: string | null;
}): { dateBR: string; hour: string } {
  let dateBR = String(r.date_br ?? "").trim();
  let hour = String(r.hour_br ?? "").trim();
  if ((!dateBR || dateBR === "undefined" || dateBR === "null") && r.kickoff_at) {
    const iso = String(r.kickoff_at).trim();
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      dateBR = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsed);
      hour = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(parsed);
    }
  }
  return { dateBR, hour };
}

function mapFromCacheRows(rows: Awaited<ReturnType<typeof readMatchesCache>>): MatchMap {
  const out: MatchMap = new Map();
  for (const r of rows) {
    const cid = Number(r.competition_id) || getFootballMainCompetitionId();
    const mid = Number(r.match_id);
    const { dateBR, hour } = dateBrHourFromCacheRow(r);
    const { resultCasa, resultVisitante } = resolveOfficialMatchResults({
      status: String(r.status || "aberto"),
      kickoffAt: r.kickoff_at,
      resultCasa: r.result_casa,
      resultVisitante: r.result_visitante,
    });
    out.set(matchMapKey(cid, mid), {
      id: mid,
      kickoffAt: r.kickoff_at,
      status: String(r.status || "aberto"),
      resultCasa,
      resultVisitante,
      home: r.home_sigla || r.home_name || "CASA",
      away: r.away_sigla || r.away_name || "VISIT",
      homeName: r.home_name || r.home_sigla || "CASA",
      awayName: r.away_name || r.away_sigla || "VISIT",
      homeLogo: r.home_logo ?? null,
      awayLogo: r.away_logo ?? null,
      dateBR,
      hour,
      competitionId: cid,
      rodada:
        r.rodada != null && Number.isFinite(Number(r.rodada)) && Number(r.rodada) > 0
          ? Number(r.rodada)
          : null,
    });
  }
  return out;
}

/** Mapa de partidas com cache em memoria (~3 min). */
export async function fetchMatchesMap(opts?: { ensureCompetitionIds?: number[] }): Promise<MatchMap> {
  const { scopeIds, scopeKey } = mergeCompetitionIdsForMatchMap(opts?.ensureCompetitionIds);
  if (
    matchMapMemoryCache &&
    matchMapMemoryCache.scopeKey === scopeKey &&
    Date.now() - matchMapMemoryCache.at < MATCH_MAP_MEMORY_TTL_MS
  ) {
    return new Map(matchMapMemoryCache.map);
  }
  const cachedRows = await readMatchesCache({ competitionIds: scopeIds }).catch(() => []);
  const map = mapFromCacheRows(cachedRows);
  matchMapMemoryCache = { at: Date.now(), map, scopeKey };
  return new Map(map);
}

/**
 * Mapa direto do Postgres, SEM cache em memoria. Usar em validacoes criticas
 * (ex.: POST /api/palpites) para apostar contra a mesma fonte que o cron grava.
 */
export async function fetchMatchesMapDirectFromDb(): Promise<MatchMap> {
  const { scopeIds } = mergeCompetitionIdsForMatchMap();
  const cachedRows = await readMatchesCache({ competitionIds: scopeIds }).catch(() => []);
  return new Map(mapFromCacheRows(cachedRows));
}
