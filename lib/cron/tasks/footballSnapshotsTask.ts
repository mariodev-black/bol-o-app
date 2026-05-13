import { fetchProviderMatches } from "@/lib/football-api";
import { downloadFasesEnrichmentMatches, downloadStandingsJson } from "@/lib/football-external-downloads";
import {
  fasesEnrichmentCacheKey,
  readFootballApiCacheJson,
  standingsCacheKey,
  upsertFootballApiCache,
} from "@/lib/football-api-cache-store";
import { syncMatchesCache } from "@/lib/matches-cache";

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

function competitionIdStr(): string {
  return (process.env.FOOTBALL_COMPETITION_ID || "72").trim();
}

function competitionIdNum(): number {
  return Number.parseInt(competitionIdStr(), 10) || 72;
}

/** Baixa tabela + todas as fases (enriquecimento) e grava em `football_api_cache`. Uso: cron diário ou rota /api/cron/football-snapshots. */
export async function runFootballSnapshotsFromApi(): Promise<{ standingsOk: boolean; fasesCount: number }> {
  const apiToken = token();
  if (!apiToken) throw new Error("FOOTBALL_API_TOKEN nao configurado");
  const compStr = competitionIdStr();
  const compNum = competitionIdNum();

  const standings = await downloadStandingsJson(compStr, apiToken);
  await upsertFootballApiCache(standingsCacheKey(compNum), compNum, standings);

  const matches = await downloadFasesEnrichmentMatches(compStr, apiToken);
  await upsertFootballApiCache(fasesEnrichmentCacheKey(compNum), compNum, { matches });

  return { standingsOk: true, fasesCount: matches.length };
}

/** Primeira subida: se não há linha de tabela no cache, baixa agora (1 sequência de API). */
export async function runFootballSnapshotsIfCacheMissing(): Promise<boolean> {
  const compNum = competitionIdNum();
  const key = standingsCacheKey(compNum);
  const existing = await readFootballApiCacheJson(key).catch(() => null);
  if (existing != null) return false;
  try {
    await runFootballSnapshotsFromApi();
    return true;
  } catch (error) {
    console.error("[football-snapshots] cold-start fill failed", error);
    return false;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __footballSnapshotBrtDate: string | undefined;
}

function brtYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function brtHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hour, minute };
}

/**
 * Primeiro tick entre 00:00–00:15 ou 01:00–01:15 (America/Sao_Paulo) a cada dia calendário BRT:
 * tabela + fases no Postgres e, na mesma sequência, sync forçado de partidas (1x GET partidas + merge leve).
 */
export async function maybeRunFootballDailySnapshot(): Promise<{
  ran: boolean;
  reason: string;
  matchesRefreshed?: boolean;
}> {
  const { hour, minute } = brtHourMinute();
  const inNightWindow =
    (hour === 0 && minute <= 15) || (hour === 1 && minute <= 15);
  if (!inNightWindow) {
    return { ran: false, reason: "fora-da-janela-noturna" };
  }
  const day = brtYmd();
  if (globalThis.__footballSnapshotBrtDate === day) {
    return { ran: false, reason: "ja-executou-hoje" };
  }
  if (!token()) {
    return { ran: false, reason: "sem-token" };
  }
  try {
    await runFootballSnapshotsFromApi();
    await syncMatchesCache({ fetchProviderMatches, force: true });
    globalThis.__footballSnapshotBrtDate = day;
    return { ran: true, reason: "snapshot-diario-brt", matchesRefreshed: true };
  } catch (error) {
    console.error("[football-snapshots] daily snapshot failed", error);
    return { ran: false, reason: "erro-api" };
  }
}
