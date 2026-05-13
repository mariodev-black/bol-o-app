import { registerMatchMapMemoryInvalidate } from "@/lib/match-map-cache-invalidator";
import { parseKickoffFromPartidaPayload, pickScoreFromPartidaPayload } from "@/lib/partida-placar";
import { readMatchesCache, requestMatchesCacheSoftSync, scheduleSaysFresh, syncMatchesCache } from "@/lib/matches-cache";

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

export type ProviderMatch = {
  matchId: number;
  phaseKey: string | null;
  groupKey: string | null;
  roundKey: string | null;
  kickoffAt: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  homeName: string;
  homeSigla: string;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string;
  awayLogo: string | null;
  dateBR: string;
  hourBR: string;
};

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
    kickoffAt: parseKickoffFromPartidaPayload(p),
    status: String(p?.status ?? "aberto"),
    resultCasa: pickScoreFromPartidaPayload(p, "casa"),
    resultVisitante: pickScoreFromPartidaPayload(p, "visitante"),
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

export type FetchMatchesMapOptions = {
  /**
   * false (default): só Postgres + cache em memória — não agenda sync com a API de futebol.
   * true: mantém comportamento antigo (soft sync quando a agenda permitir; force se cache vazia).
   */
  allowExternalSync?: boolean;
};

export async function fetchMatchesMap(options?: FetchMatchesMapOptions): Promise<MatchMap> {
  const allowExternal = options?.allowExternalSync ?? false;

  if (matchMapMemoryCache && Date.now() - matchMapMemoryCache.at < MATCH_MAP_MEMORY_TTL_MS) {
    debugLog("fetchMatchesMap:return-memory-cache", { count: matchMapMemoryCache.map.size });
    return new Map(matchMapMemoryCache.map);
  }

  const cachedRows = await readMatchesCache().catch(() => []);
  debugLog("fetchMatchesMap:start", { cachedRows: cachedRows.length, competitionId: competitionId(), allowExternal });
  if (cachedRows.length > 0) {
    if (allowExternal) {
      const podeAdiar = await scheduleSaysFresh().catch(() => false);
      if (!podeAdiar) {
        requestMatchesCacheSoftSync(fetchProviderMatches);
      }
    }
    debugLog("fetchMatchesMap:return-cache", { count: cachedRows.length });
    const map = mapFromCacheRows(cachedRows);
    matchMapMemoryCache = { at: Date.now(), map };
    return new Map(map);
  }

  if (!allowExternal) {
    debugLog("fetchMatchesMap:empty-cache-no-external");
    const empty: MatchMap = new Map();
    matchMapMemoryCache = { at: Date.now(), map: empty };
    return new Map(empty);
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

function mapFromProvider(rows: ProviderMatch[]): MatchMap {
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

export async function fetchProviderMatches(): Promise<ProviderMatch[]> {
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
    const supplement = await fetchSupplementalProviderMatchesForMerge(compId, apiToken);
    if (supplement.length > 0) {
      debugLog("fetchProviderMatches:fallback-supplement", { count: supplement.length });
      return mergeProviderMatchesWithRoundsAndDetail(compId, apiToken, supplement);
    }
    throw new Error(`Falha ao buscar partidas (${res.status})`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const fases = data?.partidas;
  const out = collectProviderMatches(fases);
  if (!fases) return mergeProviderMatchesWithRoundsAndDetail(compId, apiToken, out);
  debugLog("fetchProviderMatches:bulk-result", {
    count: out.length,
    phaseCount: fases && typeof fases === "object" && !Array.isArray(fases) ? Object.keys(fases).length : 1,
  });
  if (out.length === 0) {
    const supplement = await fetchSupplementalProviderMatchesForMerge(compId, apiToken);
    if (supplement.length > 0) {
      debugLog("fetchProviderMatches:bulk-empty-fallback-supplement", { count: supplement.length });
      return mergeProviderMatchesWithRoundsAndDetail(compId, apiToken, supplement);
    }
  }
  return mergeProviderMatchesWithRoundsAndDetail(compId, apiToken, out);
}

type RodadaListItem = {
  slug?: string;
  rodada?: number;
  status?: string;
  _link?: string;
  proxima_rodada?: { slug?: string; rodada?: number; status?: string } | null;
};

/** Lista de rodadas: a API costuma devolver um array; alguns proxies/planos podem embrulhar o corpo. */
function parseRodadasListPayload(raw: unknown): RodadaListItem[] {
  if (Array.isArray(raw)) return raw as RodadaListItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["rodadas", "data", "items", "result"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as RodadaListItem[];
    }
  }
  return [];
}

type FaseListItem = { fase_id?: number; slug?: string; nome?: string };

function parseFasesListPayload(raw: unknown): FaseListItem[] {
  if (Array.isArray(raw)) return raw as FaseListItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["fases", "data", "items", "result"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as FaseListItem[];
    }
  }
  return [];
}

/** Campeonatos tipo mata-mata (ex.: Copa do Brasil) muitas vezes nao expoem /rodadas; as partidas ficam em /fases/{id}. */
async function fetchProviderMatchesFromFases(compId: string, apiToken: string): Promise<ProviderMatch[]> {
  const listUrl = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/fases`;
  debugLog("fases:list:request", { url: listUrl });
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!listRes.ok) {
    debugLog("fases:list:failed", { status: listRes.status });
    return [];
  }
  const raw = await listRes.json().catch(() => null);
  const fasesList = parseFasesListPayload(raw);
  if (fasesList.length === 0) {
    debugLog("fases:list:empty");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      debugLog("fases:list:shape", { keys: Object.keys(raw as object).slice(0, 24) });
    }
    return [];
  }
  debugLog("fases:list:ok", { count: fasesList.length });
  const maxFases = Number.parseInt(process.env.FOOTBALL_FASES_SYNC_LIMIT ?? "32", 10) || 32;
  const byId = new Map<number, ProviderMatch>();
  for (const f of fasesList.slice(0, maxFases)) {
    const faseId = Number(f?.fase_id);
    if (!Number.isFinite(faseId)) continue;
    const detailUrl = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/fases/${faseId}`;
    try {
      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
        cache: "no-store",
      });
      if (!detailRes.ok) {
        debugLog("fases:detail:failed", { faseId, status: detailRes.status });
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = (await detailRes.json().catch(() => null)) as any;
      const chunk = collectProviderMatches(parsed);
      debugLog("fases:detail:ok", { faseId, partidas: chunk.length });
      for (const m of chunk) {
        byId.set(m.matchId, m);
      }
    } catch {
      debugLog("fases:detail:error", { faseId });
    }
  }
  const out = Array.from(byId.values());
  debugLog("fases:merge:result", { count: out.length });
  return out;
}

/** Enriquecimento em lista: rodadas (turno/regular) ou, se vazio, detalhe por fase (mata-mata). */
async function fetchSupplementalProviderMatchesForMerge(compId: string, apiToken: string): Promise<ProviderMatch[]> {
  const fromRounds = await fetchProviderMatchesFromRounds(compId, apiToken).catch(() => []);
  if (fromRounds.length > 0) return fromRounds;
  return fetchProviderMatchesFromFases(compId, apiToken).catch(() => []);
}

function mapPartidaItem(p: any, phaseKey: string, roundSlug: string): ProviderMatch | null {
  const id = Number(p?.partida_id);
  if (!Number.isFinite(id)) return null;
  return {
    matchId: id,
    phaseKey,
    groupKey: null,
    roundKey: roundSlug,
    kickoffAt: parseKickoffFromPartidaPayload(p),
    status: String(p?.status ?? "aberto"),
    resultCasa: pickScoreFromPartidaPayload(p, "casa"),
    resultVisitante: pickScoreFromPartidaPayload(p, "visitante"),
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
  const raw = await roundsRes.json().catch(() => null);
  const rounds = parseRodadasListPayload(raw);
  if (rounds.length === 0) {
    debugLog("rounds:list:empty");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      debugLog("rounds:list:shape", { keys: Object.keys(raw as object).slice(0, 24) });
    }
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

function providerTerminalSemPlacar(m: ProviderMatch): boolean {
  const s = m.status.toLowerCase();
  if (s.includes("cancel") || s.includes("adiad") || s.includes("suspens") || s.includes("interromp")) return false;
  return (
    (s.includes("encerr") || s.includes("finaliz") || s.includes("finalizada")) &&
    (m.resultCasa == null || m.resultVisitante == null)
  );
}

async function mergeProviderMatchesWithRoundsAndDetail(
  compId: string,
  apiToken: string,
  rows: ProviderMatch[]
): Promise<ProviderMatch[]> {
  let next = rows;
  if (next.length === 0 || !next.some(providerTerminalSemPlacar)) return next;
  debugLog("fetchProviderMatches:enrich-missing-scores", { bulk: next.length });
  const supplement = await fetchSupplementalProviderMatchesForMerge(compId, apiToken).catch(() => []);
  if (supplement.length > 0) {
    const byId = new Map(supplement.map((x) => [x.matchId, x]));
    next = next.map((m) => {
      if (!providerTerminalSemPlacar(m)) return m;
      const r = byId.get(m.matchId);
      if (!r) return m;
      return {
        ...m,
        resultCasa: m.resultCasa ?? r.resultCasa,
        resultVisitante: m.resultVisitante ?? r.resultVisitante,
        status: r.status || m.status,
        kickoffAt: m.kickoffAt ?? r.kickoffAt,
      };
    });
  }
  const still = next.filter(providerTerminalSemPlacar);
  if (still.length === 0) return next;
  const maxDetail = Number.parseInt(process.env.FOOTBALL_PARTIDA_DETAIL_LOOKUP_LIMIT ?? "16", 10) || 16;
  for (const m of still.slice(0, maxDetail)) {
    try {
      const detailUrl = `https://api.api-futebol.com.br/v1/partidas/${m.matchId}`;
      const dr = await fetch(detailUrl, { headers: { Authorization: `Bearer ${apiToken}` }, cache: "no-store" });
      if (!dr.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (await dr.json().catch(() => null)) as any;
      if (!p?.partida_id) continue;
      const casa = pickScoreFromPartidaPayload(p, "casa");
      const vis = pickScoreFromPartidaPayload(p, "visitante");
      if (casa == null && vis == null) continue;
      next = next.map((row) =>
        row.matchId !== m.matchId
          ? row
          : {
              ...row,
              resultCasa: row.resultCasa ?? casa,
              resultVisitante: row.resultVisitante ?? vis,
              status: String(p?.status ?? row.status),
              kickoffAt: row.kickoffAt ?? parseKickoffFromPartidaPayload(p),
            }
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}
