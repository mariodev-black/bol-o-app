/**
 * Regras do bolão diário: qual data (dd/MM/yyyy, fuso America/Sao_Paulo) vale para
 * filtrar partidas. Com palpites já salvos no ticket, a data vem só das partidas
 * correspondentes — não “pula” para o próximo dia só porque o mapa não listou hoje.
 */

import type { MatchMap } from "@/lib/match-map-types";
import { getMatchFromMap } from "@/lib/match-map-types";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";

function isCompositeMatchMap(matchMap: unknown): matchMap is MatchMap {
  if (!(matchMap instanceof Map) || matchMap.size === 0) return false;
  const first = matchMap.keys().next().value;
  return typeof first === "string" && String(first).includes(":");
}

export function brToday(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function utcMsForBrDate(dateBR: string): number | null {
  const [d, m, y] = dateBR.split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month - 1, day);
}

export function minBrDate(dates: Iterable<string>): string | null {
  const arr = [...dates].map((s) => s.trim()).filter(Boolean);
  if (arr.length === 0) return null;
  return arr.sort((a, b) => (utcMsForBrDate(a)! - utcMsForBrDate(b)!))[0] ?? null;
}

export function matchDateMapFromJogos(
  jogos: Iterable<{ id: number; dataBR?: string | null }>,
): Map<number, { dateBR: string }> {
  const m = new Map<number, { dateBR: string }>();
  for (const j of jogos) {
    const d = j.dataBR?.trim();
    if (d) m.set(j.id, { dateBR: d });
  }
  return m;
}

type PlayableMatchMeta = { dateBR?: string | null; competitionId?: number | null };

/** Mapa com `competitionId` fixo em cada partida (bolão extra no mesmo calendário). */
export function matchDateMapFromJogosWithCompetition(
  jogos: Iterable<{ id: number; dataBR?: string | null }>,
  competitionId: number,
): Map<number, PlayableMatchMeta> {
  const m = new Map<number, PlayableMatchMeta>();
  for (const j of jogos) {
    const d = j.dataBR?.trim();
    if (d) m.set(j.id, { dateBR: d, competitionId });
  }
  return m;
}

/**
 * @param matchMap match_id -> metadados com dateBR (mapa da API ou derivado dos jogos), ou `MatchMap` do Postgres (`competition_id:match_id`)
 * @param opts.lockToMatchIds se não vazio, a data jogável é a das partidas desses ids (menor data se houver mais de uma)
 * @param opts.competitionId se definido, só considera linhas do mapa com esse `competitionId` (bolão extra). Se omitido, considera todas as datas do mapa (bolão do dia no calendário já filtrado).
 */
export function resolveDiarioPlayableDate(
  matchMap: Map<number, PlayableMatchMeta> | MatchMap,
  opts?: { lockToMatchIds?: number[]; competitionId?: number },
): string {
  const lockIds = (opts?.lockToMatchIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
  if (lockIds.length > 0) {
    const dates = new Set<string>();
    const compForLock =
      opts?.competitionId != null && Number.isFinite(opts.competitionId) && opts.competitionId > 0
        ? opts.competitionId
        : getFootballMainCompetitionId();
    if (isCompositeMatchMap(matchMap)) {
      for (const id of lockIds) {
        const d = getMatchFromMap(matchMap, compForLock, id)?.dateBR?.trim();
        if (d) dates.add(d);
      }
    } else {
      for (const id of lockIds) {
        const d = matchMap.get(id)?.dateBR?.trim();
        if (d) dates.add(d);
      }
    }
    const locked = minBrDate(dates);
    if (locked) return locked;
    return brToday();
  }

  const dates = new Set<string>();
  for (const row of matchMap.values()) {
    if (opts?.competitionId != null && Number(row.competitionId) !== opts.competitionId) continue;
    const d = row.dateBR?.trim();
    if (d) dates.add(d);
  }
  const today = brToday();
  const todayMs = utcMsForBrDate(today);
  if (dates.has(today)) return today;
  const sortedFuture = [...dates]
    .map((d) => ({ d, ms: utcMsForBrDate(d) }))
    .filter((x): x is { d: string; ms: number } => x.ms != null && todayMs != null && x.ms >= todayMs)
    .sort((a, b) => a.ms - b.ms);
  return sortedFuture[0]?.d ?? today;
}
