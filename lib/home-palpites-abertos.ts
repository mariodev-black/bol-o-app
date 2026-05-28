/**
 * Vitine "Palpites abertos" na home logada: até N jogos, um por bolão quando possível.
 * Regras de abertura alinhadas a `lib/palpites-match-open` e `/boloes`.
 */

import {
  getFootballMainCompetitionId,
  parseExtraBolaoChampionshipIds,
} from "@/lib/boloes-extra-config";
import { getOutrosBoloesChampionshipIds } from "@/lib/boloes-outros-grid";
import {
  matchDateMapFromJogosWithCompetition,
  resolveDiarioPlayableDate,
} from "@/lib/diario-playable-date";
import {
  isMatchOpenForPalpite,
  type PalpiteMatchEligibilityInput,
} from "@/lib/palpites-match-open";

export type PalpiteAbertoMatch = {
  partida_id: number;
  competition_id?: number;
  status: string;
  data_realizacao: string;
  hora_realizacao: string;
  data_realizacao_iso?: string | null;
  placar_mandante?: number | null;
  placar_visitante?: number | null;
  time_mandante: {
    nome_popular?: string;
    sigla?: string;
    escudo?: string | null;
  };
  time_visitante: {
    nome_popular?: string;
    sigla?: string;
    escudo?: string | null;
  };
};

export type BolaoVitrineKey = "principal" | "diario" | `extra:${number}`;

const RECENT_MATCH_GRACE_MS = 12 * 60 * 60 * 1000;

export function partidaRecordToPalpiteAbertoMatch(
  row: Record<string, unknown>,
): PalpiteAbertoMatch | null {
  const partidaId = Number(row.partida_id);
  if (!Number.isFinite(partidaId) || partidaId <= 0) return null;

  const mandante = row.time_mandante;
  const visitante = row.time_visitante;
  if (!mandante || typeof mandante !== "object" || !visitante || typeof visitante !== "object") {
    return null;
  }

  return {
    partida_id: partidaId,
    competition_id:
      row.competition_id != null ? Number(row.competition_id) : undefined,
    status: String(row.status ?? ""),
    data_realizacao: String(row.data_realizacao ?? ""),
    hora_realizacao: String(row.hora_realizacao ?? ""),
    data_realizacao_iso:
      row.data_realizacao_iso != null ? String(row.data_realizacao_iso) : null,
    placar_mandante:
      row.placar_mandante != null ? Number(row.placar_mandante) : null,
    placar_visitante:
      row.placar_visitante != null ? Number(row.placar_visitante) : null,
    time_mandante: mandante as PalpiteAbertoMatch["time_mandante"],
    time_visitante: visitante as PalpiteAbertoMatch["time_visitante"],
  };
}

function toEligibility(match: PalpiteAbertoMatch): PalpiteMatchEligibilityInput {
  return {
    status: match.status,
    kickoffAt: match.data_realizacao_iso,
    resultCasa: match.placar_mandante,
    resultVisitante: match.placar_visitante,
  };
}

export function matchKickoffMs(match: PalpiteAbertoMatch): number {
  if (match.data_realizacao_iso) {
    const parsed = Date.parse(match.data_realizacao_iso);
    if (Number.isFinite(parsed)) return parsed;
  }
  const [day, month, year] = String(match.data_realizacao || "").split("/");
  const [hour, minute] = String(match.hora_realizacao || "00:00").split(":");
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour || 0),
    Number(minute || 0),
  ).getTime();
  return Number.isFinite(date) ? date : Number.MAX_SAFE_INTEGER;
}

function bolaoBucketPriority(): BolaoVitrineKey[] {
  const extraIds = getOutrosBoloesChampionshipIds();
  const configuredExtras = parseExtraBolaoChampionshipIds();
  const extraOrdered = [
    ...extraIds,
    ...configuredExtras.filter((id) => !extraIds.includes(id)),
  ];
  const seen = new Set<string>();
  const keys: BolaoVitrineKey[] = ["principal", "diario"];
  for (const id of extraOrdered) {
    const key = `extra:${id}` as BolaoVitrineKey;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** Um bolão por partida (diário tem prioridade sobre principal no mesmo jogo). */
function bolaoBucketForMatch(
  match: PalpiteAbertoMatch,
  mainComp: number,
  playableDate: string,
  extraIdSet: Set<number>,
  nowMs: number,
): BolaoVitrineKey | null {
  const comp = Number(match.competition_id) || mainComp;
  const eligibility = toEligibility(match);

  if (extraIdSet.has(comp)) {
    return isMatchOpenForPalpite(eligibility, "extra", nowMs) ? (`extra:${comp}` as const) : null;
  }

  if (comp !== mainComp) return null;

  const date = match.data_realizacao?.trim();
  if (
    date === playableDate &&
    isMatchOpenForPalpite(eligibility, "diario", nowMs)
  ) {
    return "diario";
  }

  if (isMatchOpenForPalpite(eligibility, "principal", nowMs)) {
    return "principal";
  }

  return null;
}

function sortByKickoff(matches: PalpiteAbertoMatch[]): PalpiteAbertoMatch[] {
  return [...matches].sort((a, b) => {
    const d = matchKickoffMs(a) - matchKickoffMs(b);
    if (d !== 0) return d;
    return a.partida_id - b.partida_id;
  });
}

/**
 * Seleciona até `limit` jogos com palpite aberto:
 * - tenta 1 por bolão (principal, diário, cada extra);
 * - se só um bolão tiver jogos, preenche com 2 desse bolão;
 * - sem repetir a mesma partida.
 */
export function pickPalpitesAbertosForHome(
  matches: PalpiteAbertoMatch[],
  limit = 2,
  nowMs = Date.now(),
): PalpiteAbertoMatch[] {
  if (limit <= 0 || matches.length === 0) return [];

  const mainComp = getFootballMainCompetitionId();
  const extraIdSet = new Set(parseExtraBolaoChampionshipIds());
  const minKickoffMs = nowMs - RECENT_MATCH_GRACE_MS;

  const eligible = matches.filter((m) => matchKickoffMs(m) >= minKickoffMs);
  if (eligible.length === 0) return [];

  const playableDate = resolveDiarioPlayableDate(
    matchDateMapFromJogosWithCompetition(
      eligible.map((m) => ({
        id: m.partida_id,
        dataBR: m.data_realizacao,
      })),
      mainComp,
    ),
    { competitionId: mainComp },
  );

  const byBucket = new Map<BolaoVitrineKey, PalpiteAbertoMatch[]>();

  for (const match of eligible) {
    const bucket = bolaoBucketForMatch(
      match,
      mainComp,
      playableDate,
      extraIdSet,
      nowMs,
    );
    if (!bucket) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(match);
    byBucket.set(bucket, list);
  }

  for (const [key, list] of byBucket) {
    byBucket.set(key, sortByKickoff(list));
  }

  const picked: PalpiteAbertoMatch[] = [];
  const usedIds = new Set<number>();

  for (const bucket of bolaoBucketPriority()) {
    if (picked.length >= limit) break;
    const list = byBucket.get(bucket);
    if (!list?.length) continue;
    for (const match of list) {
      if (usedIds.has(match.partida_id)) continue;
      picked.push(match);
      usedIds.add(match.partida_id);
      break;
    }
  }

  if (picked.length >= limit) {
    return picked.slice(0, limit);
  }

  const bucketsWithMatches = bolaoBucketPriority().filter(
    (b) => (byBucket.get(b)?.length ?? 0) > 0,
  );

  if (bucketsWithMatches.length === 1) {
    const onlyBucket = bucketsWithMatches[0]!;
    for (const match of byBucket.get(onlyBucket) ?? []) {
      if (picked.length >= limit) break;
      if (usedIds.has(match.partida_id)) continue;
      picked.push(match);
      usedIds.add(match.partida_id);
    }
  }

  if (picked.length >= limit) {
    return picked.slice(0, limit);
  }

  const fallback = sortByKickoff(
    eligible.filter((m) => {
      const bucket = bolaoBucketForMatch(
        m,
        mainComp,
        playableDate,
        extraIdSet,
        nowMs,
      );
      return bucket != null && !usedIds.has(m.partida_id);
    }),
  );

  for (const match of fallback) {
    if (picked.length >= limit) break;
    picked.push(match);
    usedIds.add(match.partida_id);
  }

  return picked.slice(0, limit);
}

/** Extrai partidas do JSON de `/api/partidas` (formato fases). */
export function collectPalpitesAbertosFromPartidasPayload(
  input: unknown,
): PalpiteAbertoMatch[] {
  const matches: PalpiteAbertoMatch[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === "object" && "partida_id" in item) {
          const mapped = partidaRecordToPalpiteAbertoMatch(
            item as Record<string, unknown>,
          );
          if (mapped) matches.push(mapped);
        } else {
          visit(item);
        }
      }
      return;
    }
    if (typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value);
      }
    }
  };
  visit(input);
  return matches;
}
