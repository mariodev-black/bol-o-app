import { registerMatchMapMemoryInvalidate } from "@/lib/match-map-cache-invalidator";
import { readMatchesCache, requestMatchesCacheSoftSync, syncMatchesCache } from "@/lib/matches-cache";

type MatchMap = Map<number, {
  id: number;
  kickoffAt: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  dateBR: string;
  hour: string;
}>;

/** Mapa em memoria: evita reler o DB e reavaliar sync a cada request (default 3 min). */
const MATCH_MAP_MEMORY_TTL_MS =
  Number.parseInt(process.env.MATCH_MAP_MEMORY_TTL_MS ?? `${3 * 60 * 1000}`, 10) || 3 * 60 * 1000;

let matchMapMemoryCache: { at: number; map: MatchMap } | null = null;

registerMatchMapMemoryInvalidate(() => {
  matchMapMemoryCache = null;
});

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

function competitionId(): string {
  return (process.env.FOOTBALL_COMPETITION_ID || "72").trim();
}

function debugEnabled(): boolean {
  const raw = (process.env.DEBUG_MATCHES_SYNC || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function debugLog(...args: unknown[]) {
  if (!debugEnabled()) return;
  console.log(...args);
}

function parseKickoffISO(dataRealizacao: string | null | undefined, hora: string | null | undefined): string | null {
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = dataRealizacao.split("/");
  if (!d || !m || !y) return null;
  const hhmm = hora.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

/** ISO do apito: usa kickoff da API/cache; se nulo, monta a partir de data/hora BR (mesmo criterio do cliente). */
export function resolveKickoffAtIso(match: {
  kickoffAt: string | null;
  dateBR: string;
  hour: string;
}): string | null {
  const k = match.kickoffAt?.trim();
  if (k) return match.kickoffAt;
  return parseKickoffISO(match.dateBR, match.hour);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickScore(p: any, side: "casa" | "visitante"): number | null {
  const keys =
    side === "casa"
      ? ["placar_mandante", "placar", "gols_mandante", "resultado_mandante"]
      : ["placar_visitante", "gols_visitante", "resultado_visitante"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

type ProviderMatch = Awaited<ReturnType<typeof fetchProviderMatches>>[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isProviderPartida(value: any): boolean {
  return (
    value &&
    typeof value === "object" &&
    Number.isFinite(Number(value.partida_id)) &&
    value.time_mandante &&
    value.time_visitante
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProviderPartida(p: any, phaseKey: string | null, groupKey: string | null, roundKey: string | null): ProviderMatch | null {
  const id = Number(p?.partida_id);
  if (!Number.isFinite(id)) return null;
  return {
    matchId: id,
    phaseKey,
    groupKey,
    roundKey,
    kickoffAt: parseKickoffISO(p.data_realizacao, p.hora_realizacao),
    status: String(p?.status ?? "aberto"),
    resultCasa: pickScore(p, "casa"),
    resultVisitante: pickScore(p, "visitante"),
    homeName: String(p?.time_mandante?.nome_popular ?? p?.time_mandante?.sigla ?? "CASA"),
    homeSigla: String(p?.time_mandante?.sigla ?? p?.time_mandante?.nome_popular ?? "CASA"),
    homeLogo: p?.time_mandante?.escudo ? String(p.time_mandante.escudo) : null,
    awayName: String(p?.time_visitante?.nome_popular ?? p?.time_visitante?.sigla ?? "VISIT"),
    awaySigla: String(p?.time_visitante?.sigla ?? p?.time_visitante?.nome_popular ?? "VISIT"),
    awayLogo: p?.time_visitante?.escudo ? String(p.time_visitante.escudo) : null,
    dateBR: String(p?.data_realizacao ?? ""),
    hourBR: String(p?.hora_realizacao ?? ""),
  };
}

function normalizeKey(value: string, fallback: string): string {
  return String(value || fallback).trim() || fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectProviderMatches(node: any, path: string[] = [], out: ProviderMatch[] = []): ProviderMatch[] {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (isProviderPartida(item)) {
        const mapped = mapProviderPartida(
          item,
          normalizeKey(path[0] ?? "geral", "geral"),
          path.length >= 3 ? normalizeKey(path[1]!, "grupo-geral") : null,
          normalizeKey(path[path.length - 1] ?? "rodada-unica", "rodada-unica")
        );
        if (mapped) out.push(mapped);
      } else {
        collectProviderMatches(item, path, out);
      }
    }
    return out;
  }
  if (typeof node === "object") {
    if (isProviderPartida(node)) {
      const mapped = mapProviderPartida(
        node,
        normalizeKey(path[0] ?? "geral", "geral"),
        path.length >= 3 ? normalizeKey(path[1]!, "grupo-geral") : null,
        normalizeKey(path[path.length - 1] ?? "rodada-unica", "rodada-unica")
      );
      if (mapped) out.push(mapped);
      return out;
    }
    for (const [key, value] of Object.entries(node)) {
      collectProviderMatches(value, [...path, key], out);
    }
  }
  return out;
}

export async function fetchMatchesMap(): Promise<MatchMap> {
  if (matchMapMemoryCache && Date.now() - matchMapMemoryCache.at < MATCH_MAP_MEMORY_TTL_MS) {
    debugLog("fetchMatchesMap:return-memory-cache", { count: matchMapMemoryCache.map.size });
    return new Map(matchMapMemoryCache.map);
  }

  const cachedRows = await readMatchesCache().catch(() => []);
  debugLog("fetchMatchesMap:start", { cachedRows: cachedRows.length, competitionId: competitionId() });
  if (cachedRows.length > 0) {
    requestMatchesCacheSoftSync(fetchProviderMatches);
    debugLog("fetchMatchesMap:return-cache", { count: cachedRows.length });
    const map = mapFromCacheRows(cachedRows);
    matchMapMemoryCache = { at: Date.now(), map };
    return new Map(map);
  }

  await syncMatchesCache({ fetchProviderMatches: fetchProviderMatches, force: true }).catch(() => {});
  const rowsAfterSync = await readMatchesCache().catch(() => []);
  if (rowsAfterSync.length > 0) {
    debugLog("fetchMatchesMap:return-cache-after-sync", { count: rowsAfterSync.length });
    const map = mapFromCacheRows(rowsAfterSync);
    matchMapMemoryCache = { at: Date.now(), map };
    return new Map(map);
  }

  debugLog("fetchMatchesMap:fallback-provider");
  const map = mapFromProvider(await fetchProviderMatches());
  matchMapMemoryCache = { at: Date.now(), map };
  return new Map(map);
}

function mapFromCacheRows(rows: Awaited<ReturnType<typeof readMatchesCache>>): MatchMap {
  const out: MatchMap = new Map();
  for (const r of rows) {
    out.set(Number(r.match_id), {
      id: Number(r.match_id),
      kickoffAt: r.kickoff_at,
      status: String(r.status || "aberto"),
      resultCasa: r.result_casa,
      resultVisitante: r.result_visitante,
      home: r.home_sigla || r.home_name || "CASA",
      away: r.away_sigla || r.away_name || "VISIT",
      homeName: r.home_name || r.home_sigla || "CASA",
      awayName: r.away_name || r.away_sigla || "VISIT",
      homeLogo: r.home_logo ?? null,
      awayLogo: r.away_logo ?? null,
      dateBR: r.date_br || "",
      hour: r.hour_br || "",
    });
  }
  return out;
}

function mapFromProvider(rows: Awaited<ReturnType<typeof fetchProviderMatches>>): MatchMap {
  const out: MatchMap = new Map();
  for (const p of rows) {
    out.set(p.matchId, {
      id: p.matchId,
      kickoffAt: p.kickoffAt,
      status: p.status,
      resultCasa: p.resultCasa,
      resultVisitante: p.resultVisitante,
      home: p.homeSigla || p.homeName || "CASA",
      away: p.awaySigla || p.awayName || "VISIT",
      homeName: p.homeName || p.homeSigla || "CASA",
      awayName: p.awayName || p.awaySigla || "VISIT",
      homeLogo: p.homeLogo ?? null,
      awayLogo: p.awayLogo ?? null,
      dateBR: p.dateBR,
      hour: p.hourBR,
    });
  }
  return out;
}

export async function fetchProviderMatches(): Promise<
  Array<{
    matchId: number;
    phaseKey: string | null;
    groupKey: string | null;
    roundKey: string | null;
    status: string;
    kickoffAt: string | null;
    dateBR: string;
    hourBR: string;
    resultCasa: number | null;
    resultVisitante: number | null;
    homeName: string;
    homeSigla: string;
    homeLogo: string | null;
    awayName: string;
    awaySigla: string;
    awayLogo: string | null;
  }>
> {
  const apiToken = token();
  if (!apiToken) throw new Error("FOOTBALL_API_TOKEN nao configurado");
  const compId = competitionId();
  debugLog("fetchProviderMatches:start", { competitionId: compId });

  const url = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/partidas`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    debugLog("fetchProviderMatches:bulk-failed", { status: res.status });
    const fromRounds = await fetchProviderMatchesFromRounds(compId, apiToken).catch(() => []);
    if (fromRounds.length > 0) {
      debugLog("fetchProviderMatches:fallback-from-rounds", { count: fromRounds.length });
      return fromRounds;
    }
    throw new Error(`Falha ao buscar partidas (${res.status})`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const fases = data?.partidas;
  const out = collectProviderMatches(fases);
  if (!fases) return out;
  debugLog("fetchProviderMatches:bulk-result", {
    count: out.length,
    phaseCount: fases && typeof fases === "object" && !Array.isArray(fases) ? Object.keys(fases).length : 1,
  });
  if (out.length === 0) {
    const fromRounds = await fetchProviderMatchesFromRounds(compId, apiToken).catch(() => []);
    if (fromRounds.length > 0) {
      debugLog("fetchProviderMatches:bulk-empty-fallback-rounds", { count: fromRounds.length });
      return fromRounds;
    }
  }
  return out;
}

type RodadaListItem = {
  slug?: string;
  rodada?: number;
  status?: string;
  _link?: string;
  proxima_rodada?: { slug?: string; rodada?: number; status?: string } | null;
};

function mapPartidaItem(
  p: any,
  phaseKey: string,
  roundSlug: string
): {
  matchId: number;
  phaseKey: string | null;
  groupKey: string | null;
  roundKey: string | null;
  status: string;
  kickoffAt: string | null;
  dateBR: string;
  hourBR: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  homeName: string;
  homeSigla: string;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string;
  awayLogo: string | null;
} | null {
  const id = Number(p?.partida_id);
  if (!Number.isFinite(id)) return null;
  return {
    matchId: id,
    phaseKey,
    groupKey: null,
    roundKey: roundSlug,
    kickoffAt: parseKickoffISO(p?.data_realizacao, p?.hora_realizacao),
    status: String(p?.status ?? "aberto"),
    resultCasa: pickScore(p, "casa"),
    resultVisitante: pickScore(p, "visitante"),
    homeName: String(p?.time_mandante?.nome_popular ?? p?.time_mandante?.sigla ?? "CASA"),
    homeSigla: String(p?.time_mandante?.sigla ?? p?.time_mandante?.nome_popular ?? "CASA"),
    homeLogo: p?.time_mandante?.escudo ? String(p.time_mandante.escudo) : null,
    awayName: String(p?.time_visitante?.nome_popular ?? p?.time_visitante?.sigla ?? "VISIT"),
    awaySigla: String(p?.time_visitante?.sigla ?? p?.time_visitante?.nome_popular ?? "VISIT"),
    awayLogo: p?.time_visitante?.escudo ? String(p.time_visitante.escudo) : null,
    dateBR: String(p?.data_realizacao ?? ""),
    hourBR: String(p?.hora_realizacao ?? ""),
  };
}

async function fetchProviderMatchesFromRounds(compId: string, apiToken: string) {
  const roundsUrl = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/rodadas`;
  debugLog("rounds:list:request", { url: roundsUrl });
  const roundsRes = await fetch(roundsUrl, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!roundsRes.ok) {
    debugLog("rounds:list:failed", { status: roundsRes.status });
    return [];
  }
  const rounds = (await roundsRes.json().catch(() => [])) as RodadaListItem[];
  if (!Array.isArray(rounds) || rounds.length === 0) {
    debugLog("rounds:list:empty");
    return [];
  }
  debugLog("rounds:list:ok", { count: rounds.length });

  // Dinamico por campeonato: para o bolao geral precisamos da competicao inteira.
  // A API Futebol expõe a lista em /campeonatos/{id}/rodadas; a partir dela
  // buscamos cada rodada, independente de estar aberta ou encerrada.
  const selectedRounds = rounds;
  if (selectedRounds.length === 0) {
    debugLog("rounds:targets:not-found");
    return [];
  }

  const targetRounds = new Map<string, { slug?: string; rodada?: number }>();
  const maxRounds = Number.parseInt(process.env.FOOTBALL_ROUNDS_SYNC_LIMIT ?? "80", 10) || 80;
  for (const round of selectedRounds.slice(0, maxRounds)) {
    const ref = round.slug || String(round.rodada || "");
    if (ref) targetRounds.set(ref, { slug: round.slug, rodada: round.rodada });
  }
  debugLog("rounds:targets", { targets: Array.from(targetRounds.entries()) });

  const out: Array<ReturnType<typeof mapPartidaItem> extends infer T ? Exclude<T, null> : never> = [];
  for (const [roundRef, meta] of targetRounds) {
    const detailCandidates = [
      meta.rodada ? `https://api.api-futebol.com.br/v1/campeonatos/${compId}/rodadas/${meta.rodada}` : "",
      `https://api.api-futebol.com.br/v1/campeonatos/${compId}/rodadas/${roundRef}`,
    ].filter(Boolean);

    let detail: any = null;
    let resolvedRoundRef = roundRef;
    for (const detailUrl of detailCandidates) {
      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
        cache: "no-store",
      });
      if (!detailRes.ok) {
        debugLog("rounds:detail:failed", { roundRef, detailUrl, status: detailRes.status });
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = (await detailRes.json().catch(() => null)) as any;
      const partidasCandidate = Array.isArray(parsed?.partidas) ? parsed.partidas : [];
      if (partidasCandidate.length > 0 || !detail) {
        detail = parsed;
        resolvedRoundRef = detailUrl;
      }
      if (partidasCandidate.length > 0) break;
    }

    if (!detail) continue;
    const roundSlug = String(detail?.slug || roundRef);
    const partidas = Array.isArray(detail?.partidas) ? detail.partidas : [];
    debugLog("rounds:detail:ok", { roundRef, resolvedRoundRef, slug: roundSlug, partidas: partidas.length });
    for (const p of partidas) {
      const mapped = mapPartidaItem(p, "rodadas", roundSlug);
      if (mapped) out.push(mapped);
    }
  }
  debugLog("rounds:result", { count: out.length });
  return out;
}

