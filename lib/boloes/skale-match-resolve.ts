import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoCompetition,
  isSkaleBolaoEnabled,
} from "@/lib/boloes/skale-config";
import { mirrorSkaleBolaoMatchesFromCopa } from "@/lib/football/skale-bolao-sync";
import { getMatchFromMap, type MatchMap, type MatchMapEntry } from "@/lib/football-api";

/**
 * Partida para palpites/ranking do bolão Skale.
 * Placar e status vêm da Copa (fonte principal) — o espelho sintético pode atrasar.
 */
export function resolveBolaoMatchFromMap(
  map: MatchMap,
  competitionId: number,
  matchId: number,
): MatchMapEntry | undefined {
  if (isSkaleBolaoCompetition(competitionId)) {
    const copaId = getSkaleBolaoSourceCopaCompetitionId();
    const copaMatch = getMatchFromMap(map, copaId, matchId);
    if (copaMatch) {
      return { ...copaMatch, competitionId };
    }
  }
  return getMatchFromMap(map, competitionId, matchId);
}

export function isMatchInSkaleBolaoPool(
  match: { competitionId: number },
  skaleComp: number = getSkaleBolaoCompetitionId(),
): boolean {
  if (Number(match.competitionId) === skaleComp) return true;
  if (
    isSkaleBolaoCompetition(skaleComp) &&
    Number(match.competitionId) === getSkaleBolaoSourceCopaCompetitionId()
  ) {
    return true;
  }
  return false;
}

/** Garante `matches_cache` do bolão Skale antes de contar jogos ou pontuar. */
export async function ensureSkaleBolaoMatchesMirrored(): Promise<void> {
  if (!isSkaleBolaoEnabled()) return;
  await mirrorSkaleBolaoMatchesFromCopa().catch(() => {});
}

export function skaleCompetitionIdsForMatchMap(): number[] {
  if (!isSkaleBolaoEnabled()) return [];
  return [getSkaleBolaoCompetitionId(), getSkaleBolaoSourceCopaCompetitionId()];
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
