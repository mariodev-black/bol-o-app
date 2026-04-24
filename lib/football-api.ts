import { readMatchesCache, syncMatchesCache } from "@/lib/matches-cache";

type MatchMap = Map<number, {
  id: number;
  kickoffAt: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  dateBR: string;
  hour: string;
}>;

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
  console.log("[matches-sync]", ...args);
}

function parseKickoffISO(dataRealizacao: string | null | undefined, hora: string | null | undefined): string | null {
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = dataRealizacao.split("/");
  if (!d || !m || !y) return null;
  const hhmm = hora.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
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

export async function fetchMatchesMap(): Promise<MatchMap> {
  const cachedRows = await readMatchesCache().catch(() => []);
  debugLog("fetchMatchesMap:start", { cachedRows: cachedRows.length, competitionId: competitionId() });
  if (cachedRows.length > 0) {
    void syncMatchesCache({ fetchProviderMatches: fetchProviderMatches, force: false }).catch(() => {});
    debugLog("fetchMatchesMap:return-cache", { count: cachedRows.length });
    return mapFromCacheRows(cachedRows);
  }

  await syncMatchesCache({ fetchProviderMatches: fetchProviderMatches, force: true }).catch(() => {});
  const rowsAfterSync = await readMatchesCache().catch(() => []);
  if (rowsAfterSync.length > 0) {
    debugLog("fetchMatchesMap:return-cache-after-sync", { count: rowsAfterSync.length });
    return mapFromCacheRows(rowsAfterSync);
  }

  debugLog("fetchMatchesMap:fallback-provider");
  return mapFromProvider(await fetchProviderMatches());
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
  const fromRounds = await fetchProviderMatchesFromRounds(compId, apiToken).catch(() => []);
  if (fromRounds.length > 0) {
    debugLog("fetchProviderMatches:from-rounds", { count: fromRounds.length });
    return fromRounds;
  }
  debugLog("fetchProviderMatches:rounds-empty-fallback-bulk");

  const url = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/partidas`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha ao buscar partidas (${res.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const fases = data?.partidas as Record<string, unknown> | undefined;
  const out: Array<{
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
  }> = [];
  if (!fases) return out;

  for (const [phaseKey, phaseValue] of Object.entries(fases)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phaseObj = phaseValue as any;
    if (!phaseObj || typeof phaseObj !== "object") continue;

    const phaseEntries = Object.entries(phaseObj);
    for (const [sectionKey, sectionValue] of phaseEntries) {
      if (Array.isArray(sectionValue)) {
        // ex.: fase mata-mata com arrays diretos por rodada
        for (const p of sectionValue as any[]) {
          const id = Number(p?.partida_id);
          if (!Number.isFinite(id)) continue;
          out.push({
            matchId: id,
            phaseKey,
            groupKey: null,
            roundKey: sectionKey,
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
          });
        }
        continue;
      }

      if (!sectionValue || typeof sectionValue !== "object") continue;
      const rounds = Object.entries(sectionValue as Record<string, unknown>).filter(([, value]) => Array.isArray(value));
      for (const [roundKey, roundValue] of rounds) {
        for (const p of roundValue as any[]) {
          const id = Number(p?.partida_id);
          if (!Number.isFinite(id)) continue;
          out.push({
            matchId: id,
            phaseKey,
            groupKey: sectionKey,
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
          });
        }
      }
    }
  }
  debugLog("fetchProviderMatches:bulk-result", { count: out.length, phaseCount: Object.keys(fases).length });
  return out;
}

type RodadaListItem = {
  slug?: string;
  rodada?: number;
  status?: string;
  _link?: string;
  proxima_rodada?: { slug?: string; rodada?: number; status?: string } | null;
};

function rodadaIsOpen(status: string | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s !== "encerrada";
}

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

  const firstOpen = rounds.find((r) => rodadaIsOpen(r.status));
  if (!firstOpen?.slug && !firstOpen?.rodada) {
    debugLog("rounds:first-open:not-found");
    return [];
  }

  const targetRounds = new Map<string, { slug?: string; rodada?: number }>();
  const firstOpenRef = firstOpen.slug || String(firstOpen.rodada || "");
  if (firstOpenRef) targetRounds.set(firstOpenRef, { slug: firstOpen.slug, rodada: firstOpen.rodada });
  const next = firstOpen.proxima_rodada;
  if (next && rodadaIsOpen(next.status)) {
    const nextRef = next.slug || String(next.rodada || "");
    if (nextRef) targetRounds.set(nextRef, { slug: next.slug, rodada: next.rodada });
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

