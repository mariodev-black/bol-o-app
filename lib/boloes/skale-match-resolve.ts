import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoCompetition,
  isSkaleBolaoEnabled,
} from "@/lib/boloes/skale-config";
import {
  getWeekendBolaoSourceCopaCompetitionId,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";
import {
  getSkaleDailyBolaoCompetitionId,
  isSkaleDailyBolaoCompetition,
  isSkaleDailyBolaoEnabled,
} from "@/lib/boloes/skale-daily-config";
import {
  mirrorAllSkaleBolaoMatchesFromCopa,
  mirrorSkaleBolaoMatchesFromCopa,
  mirrorSkaleDailyBolaoMatchesFromCopa,
} from "@/lib/football/skale-bolao-sync";
import { getMatchFromMap, type MatchMap, type MatchMapEntry } from "@/lib/football-api";

/** Bolões extra que espelham a Copa inteira (ou subconjunto) — palpite livre por rodada. */
export function isFullCopaMirrorBolao(
  championshipId: number | undefined | null,
): boolean {
  return (
    isSkaleBolaoCompetition(championshipId) ||
    isWeekendBolaoCompetition(championshipId)
  );
}

function resolveFromCopaSource(
  map: MatchMap,
  competitionId: number,
  matchId: number,
  copaId: number,
): MatchMapEntry | undefined {
  const copaMatch = getMatchFromMap(map, copaId, matchId);
  if (copaMatch) {
    return { ...copaMatch, competitionId };
  }
  return getMatchFromMap(map, competitionId, matchId);
}

/**
 * Partida para palpites/ranking do bolão Skale.
 * Placar e status vêm da Copa (fonte principal) — o espelho sintético pode atrasar.
 */
export function resolveBolaoMatchFromMap(
  map: MatchMap,
  competitionId: number,
  matchId: number,
): MatchMapEntry | undefined {
  if (
    isSkaleBolaoCompetition(competitionId) ||
    isSkaleDailyBolaoCompetition(competitionId)
  ) {
    return resolveFromCopaSource(
      map,
      competitionId,
      matchId,
      getSkaleBolaoSourceCopaCompetitionId(),
    );
  }
  if (isWeekendBolaoCompetition(competitionId)) {
    return resolveFromCopaSource(
      map,
      competitionId,
      matchId,
      getWeekendBolaoSourceCopaCompetitionId(),
    );
  }
  return getMatchFromMap(map, competitionId, matchId);
}

export function isMatchInSkaleBolaoPool(
  match: { competitionId: number },
  skaleComp: number = getSkaleBolaoCompetitionId(),
): boolean {
  if (Number(match.competitionId) === skaleComp) return true;
  if (
    (isSkaleBolaoCompetition(skaleComp) ||
      isSkaleDailyBolaoCompetition(skaleComp)) &&
    Number(match.competitionId) === getSkaleBolaoSourceCopaCompetitionId()
  ) {
    return true;
  }
  return false;
}

/** Garante espelho Skale integral + diário antes de contar jogos ou pontuar. */
export async function ensureSkaleBolaoMatchesMirrored(): Promise<void> {
  await mirrorAllSkaleBolaoMatchesFromCopa().catch(() => {});
}

export async function ensureSkaleDailyBolaoMatchesMirrored(): Promise<void> {
  if (!isSkaleDailyBolaoEnabled()) return;
  await mirrorSkaleDailyBolaoMatchesFromCopa().catch(() => {});
}

export function skaleCompetitionIdsForMatchMap(): number[] {
  const ids: number[] = [getSkaleBolaoSourceCopaCompetitionId()];
  if (isSkaleBolaoEnabled()) ids.push(getSkaleBolaoCompetitionId());
  if (isSkaleDailyBolaoEnabled()) ids.push(getSkaleDailyBolaoCompetitionId());
  return ids;
}

/** Todas as partidas da Copa no escopo Skale (espelho + fonte), sem duplicar `match_id`. */
export function skaleScopeMatchesFromMap(
  map: MatchMap,
  skaleComp: number = getSkaleBolaoCompetitionId(),
): MatchMapEntry[] {
  const copaId = getSkaleBolaoSourceCopaCompetitionId();
  const byMatchId = new Map<number, MatchMapEntry>();
  for (const m of map.values()) {
    const cid = Number(m.competitionId);
    if (cid !== skaleComp && cid !== copaId) continue;
    if (!byMatchId.has(m.id)) {
      byMatchId.set(m.id, { ...m, competitionId: skaleComp });
    }
  }
  return [...byMatchId.values()];
}
