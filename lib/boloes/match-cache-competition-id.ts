import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoCompetition,
} from "@/lib/boloes/skale-config";
import {
  getSkaleDailyBolaoCompetitionId,
  isSkaleDailyBolaoCompetition,
} from "@/lib/boloes/skale-daily-config";
import {
  getWeekendBolaoSourceCopaCompetitionId,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";

/** competition_id em matches_cache para pontuação/leitura (espelhos Skale/FDS → Copa fonte). */
export function matchesCacheCompetitionIdForBolao(
  bolaoType: string,
  extraChampionshipId: number | null | undefined,
): number {
  const main = getFootballMainCompetitionId();
  if (bolaoType !== "extra" || extraChampionshipId == null || !Number.isFinite(extraChampionshipId)) {
    return main;
  }
  const cid = Number(extraChampionshipId);
  if (isSkaleBolaoCompetition(cid) || isSkaleDailyBolaoCompetition(cid)) {
    return getSkaleBolaoSourceCopaCompetitionId();
  }
  if (isWeekendBolaoCompetition(cid)) {
    return getWeekendBolaoSourceCopaCompetitionId();
  }
  return cid;
}

/** IDs de competição a incluir no MatchMap quando o bolão espelha a Copa. */
export function ensureCompetitionIdsForBolaoExtra(
  extraChampionshipId: number | null | undefined,
): number[] {
  const ids: number[] = [];
  if (extraChampionshipId == null || !Number.isFinite(extraChampionshipId)) return ids;
  const cid = Number(extraChampionshipId);
  ids.push(cid);
  if (isSkaleBolaoCompetition(cid) || isSkaleDailyBolaoCompetition(cid)) {
    ids.push(getSkaleBolaoSourceCopaCompetitionId());
  } else if (isWeekendBolaoCompetition(cid)) {
    ids.push(getWeekendBolaoSourceCopaCompetitionId());
  }
  return ids;
}

/** Comp IDs sintéticos Skale (90007 + 90009) para SQL IN (...). */
export function skaleMirrorCompetitionIdsSqlList(): number[] {
  const ids = [getSkaleBolaoCompetitionId()];
  try {
    ids.push(getSkaleDailyBolaoCompetitionId());
  } catch {
    /* daily desabilitado */
  }
  return ids;
}
