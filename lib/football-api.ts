import { fetchFootballApiV1 } from "@/lib/football-api-fetch";
import { getFootballMainCompetitionId, getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { registerMatchMapMemoryInvalidate } from "@/lib/match-map-cache-invalidator";
import { parseKickoffFromPartidaPayload, pickScoreFromPartidaPayload } from "@/lib/partida-placar";
import { fasesEnrichmentCacheKey, readFootballApiCacheJson } from "@/lib/football-api-cache-store";
import { readMatchesCache } from "@/lib/matches-cache";
import { matchEndClockMinutesAfterKickoff } from "@/lib/cron/match-result-guarantee";
import type { MatchMap } from "@/lib/match-map-types";
import { matchMapKey } from "@/lib/match-map-types";

export type { MatchMap, MatchMapEntry } from "@/lib/match-map-types";
export { getMatchFromMap, matchMapKey } from "@/lib/match-map-types";

/** Mapa em memoria: evita reler o DB e reavaliar sync a cada request (default 3 min). */
const MATCH_MAP_MEMORY_TTL_MS =
  Number.parseInt(process.env.MATCH_MAP_MEMORY_TTL_MS ?? `${3 * 60 * 1000}`, 10) || 3 * 60 * 1000;

let matchMapMemoryCache: { at: number; map: MatchMap; scopeKey: string } | null = null;

registerMatchMapMemoryInvalidate(() => {
  matchMapMemoryCache = null;
});

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

function competitionId(): string {
  return String(getFootballMainCompetitionId());
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
  /** Preenchido no sync multi-campeonato. */
  competitionId?: number;
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
export function collectProviderMatches(node: any, path: string[] = [], out: ProviderMatch[] = []): ProviderMatch[] {
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

function mergeCompetitionIdsForMatchMap(ensureCompetitionIds?: number[]): { scopeIds: number[]; scopeKey: string } {
  const base = getAllSyncedCompetitionIds();
  const extra = (ensureCompetitionIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const scopeIds = [...new Set([...base, ...extra])];
  const scopeKey = scopeIds.slice().sort((a, b) => a - b).join(",");
  return { scopeIds, scopeKey };
}

/** Mapa de partidas só a partir do Postgres (`matches_cache`). Servidor preenche via cron/bootstrap. */
export async function fetchMatchesMap(opts?: { ensureCompetitionIds?: number[] }): Promise<MatchMap> {
  const { scopeIds, scopeKey } = mergeCompetitionIdsForMatchMap(opts?.ensureCompetitionIds);
  if (
    matchMapMemoryCache &&
    matchMapMemoryCache.scopeKey === scopeKey &&
    Date.now() - matchMapMemoryCache.at < MATCH_MAP_MEMORY_TTL_MS
  ) {
    debugLog("fetchMatchesMap:return-memory-cache", { count: matchMapMemoryCache.map.size, scopeKey });
    return new Map(matchMapMemoryCache.map);
  }

  const cachedRows = await readMatchesCache({ competitionIds: scopeIds }).catch(() => []);
  debugLog("fetchMatchesMap:start", {
    cachedRows: cachedRows.length,
    competitionId: competitionId(),
    scopeIds,
    scopeKey,
  });
  const map = mapFromCacheRows(cachedRows);
  matchMapMemoryCache = { at: Date.now(), map, scopeKey };
  return new Map(map);
}

/**
 * Mapa direto do Postgres (`matches_cache`), sem cache em memoria.
 * Usar em validacoes criticas (ex.: POST /api/palpites) para apostar/editar
 * com a mesma fonte que o cron grava (`date_br`, status, placar).
 */
export async function fetchMatchesMapDirectFromDb(): Promise<MatchMap> {
  const { scopeIds } = mergeCompetitionIdsForMatchMap();
  const cachedRows = await readMatchesCache({ competitionIds: scopeIds }).catch(() => []);
  return new Map(mapFromCacheRows(cachedRows));
}

function mapFromCacheRows(rows: Awaited<ReturnType<typeof readMatchesCache>>): MatchMap {
  const out: MatchMap = new Map();
  for (const r of rows) {
    const cid = Number(r.competition_id) || getFootballMainCompetitionId();
    const mid = Number(r.match_id);
    out.set(matchMapKey(cid, mid), {
      id: mid,
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
      competitionId: cid,
    });
  }
  return out;
}

/** Partidas de todos os campeonatos sincronizados (principal + `BOLOES_EXTRA_CHAMPIONSHIP_IDS`). */
export async function fetchProviderMatchesForAllSyncedCompetitions(): Promise<ProviderMatch[]> {
  const { getAllSyncedCompetitionIds } = await import("@/lib/boloes-extra-config");
  const merged: ProviderMatch[] = [];
  for (const id of getAllSyncedCompetitionIds()) {
    const chunk = await fetchProviderMatches(String(id));
    for (const m of chunk) {
      merged.push({ ...m, competitionId: id });
    }
  }
  return merged;
}

export async function fetchProviderMatches(overrideCompetitionId?: string): Promise<ProviderMatch[]> {
  const apiToken = token();
  if (!apiToken) throw new Error("FOOTBALL_API_TOKEN nao configurado");
  const compId = (overrideCompetitionId ?? competitionId()).trim();
  debugLog("fetchProviderMatches:start", { competitionId: compId });

  const url = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/partidas`;
  const res = await fetchFootballApiV1(url, {
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

/** Snapshot gravado pelo cron (tabela + fases); substitui N+1 HTTP em cada sync de partidas. */
async function loadFasesEnrichmentFromSnapshot(compId: string): Promise<ProviderMatch[]> {
  const n = Number.parseInt(compId, 10) || 0;
  const raw = await readFootballApiCacheJson(fasesEnrichmentCacheKey(n)).catch(() => null);
  if (!raw || typeof raw !== "object") return [];
  const matches = (raw as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];
  const out: ProviderMatch[] = [];
  for (const item of matches) {
    if (item && typeof item === "object" && Number.isFinite(Number((item as ProviderMatch).matchId))) {
      out.push(item as ProviderMatch);
    }
  }
  return out;
}

/** Campeonatos tipo mata-mata: enriquecimento vem do snapshot diario no Postgres, nao da API em tempo real. */
async function fetchProviderMatchesFromFases(compId: string, _apiToken: string): Promise<ProviderMatch[]> {
  const fromDb = await loadFasesEnrichmentFromSnapshot(compId);
  if (fromDb.length > 0) {
    debugLog("fases:from-db-snapshot", { count: fromDb.length });
    return fromDb;
  }
  debugLog("fases:snapshot-empty");
  return [];
}

/** Enriquecimento: snapshot diario (Postgres); rodadas na API so com FOOTBALL_ROUNDS_LIVE_ENRICH=1 (consome muita cota). */
async function fetchSupplementalProviderMatchesForMerge(compId: string, apiToken: string): Promise<ProviderMatch[]> {
  const fromSnapshot = await loadFasesEnrichmentFromSnapshot(compId);
  if (fromSnapshot.length > 0) return fromSnapshot;
  const allowRounds = ["1", "true", "yes"].includes((process.env.FOOTBALL_ROUNDS_LIVE_ENRICH || "").trim().toLowerCase());
  if (!allowRounds) return [];
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
  const roundsRes = await fetchFootballApiV1(roundsUrl, {
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
      const detailRes = await fetchFootballApiV1(detailUrl, {
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

function providerKickoffMs(m: ProviderMatch): number | null {
  if (m.kickoffAt) {
    const t = Date.parse(m.kickoffAt);
    if (Number.isFinite(t)) return t;
  }
  const [d, mo, y] = String(m.dateBR || "").split("/");
  const [hh, mm] = String(m.hourBR || "").split(":");
  if (!d || !mo || !y) return null;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

function providerExcludedFromScoreDetail(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

function providerMissingOfficialScore(m: ProviderMatch): boolean {
  return m.resultCasa == null || m.resultVisitante == null;
}

function providerTerminalSemPlacar(m: ProviderMatch): boolean {
  const s = m.status.toLowerCase();
  if (s.includes("cancel") || s.includes("adiad") || s.includes("suspens") || s.includes("interromp")) return false;
  return (
    (s.includes("encerr") || s.includes("finaliz") || s.includes("finalizada")) &&
    (m.resultCasa == null || m.resultVisitante == null)
  );
}

/** Inclui “finalizado na API sem placar no bulk” e jogos já após apito + MATCH_END_CLOCK sem placar completo (lista /partidas costuma atrasar status). */
function providerNeedsScoreEnrichment(m: ProviderMatch, clockMinAfterKickoff: number, nowMs: number): boolean {
  if (providerExcludedFromScoreDetail(m.status)) return false;
  if (!providerMissingOfficialScore(m)) return false;
  if (providerTerminalSemPlacar(m)) return true;
  const ko = providerKickoffMs(m);
  if (ko == null) return false;
  return ko + clockMinAfterKickoff * 60_000 < nowMs;
}

async function mergeProviderMatchesWithRoundsAndDetail(
  compId: string,
  apiToken: string,
  rows: ProviderMatch[]
): Promise<ProviderMatch[]> {
  let next = rows;
  const clockMin = matchEndClockMinutesAfterKickoff();
  const nowMs = Date.now();
  if (next.length === 0 || !next.some((m) => providerNeedsScoreEnrichment(m, clockMin, nowMs))) return next;
  const enrichCount = next.filter((m) => providerNeedsScoreEnrichment(m, clockMin, nowMs)).length;
  debugLog("fetchProviderMatches:enrich-missing-scores", { bulk: next.length, candidates: enrichCount });
  const supplement = await fetchSupplementalProviderMatchesForMerge(compId, apiToken).catch(() => []);
  if (supplement.length > 0) {
    const byId = new Map(supplement.map((x) => [x.matchId, x]));
    next = next.map((m) => {
      if (!providerNeedsScoreEnrichment(m, clockMin, nowMs)) return m;
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
  const nowAfter = Date.now();
  let still = next.filter((m) => providerNeedsScoreEnrichment(m, clockMin, nowAfter));
  if (still.length === 0) return next;
  still = still.slice().sort((a, b) => {
    const ta = providerTerminalSemPlacar(a) ? 0 : 1;
    const tb = providerTerminalSemPlacar(b) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return (providerKickoffMs(a) ?? Infinity) - (providerKickoffMs(b) ?? Infinity);
  });
  const maxDetail = Number.parseInt(process.env.FOOTBALL_PARTIDA_DETAIL_LOOKUP_LIMIT ?? "16", 10) || 16;
  for (const m of still.slice(0, maxDetail)) {
    try {
      const detailUrl = `https://api.api-futebol.com.br/v1/partidas/${m.matchId}`;
      const dr = await fetchFootballApiV1(detailUrl, { headers: { Authorization: `Bearer ${apiToken}` }, cache: "no-store" });
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
