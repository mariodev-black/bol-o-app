import { getAmistososFriendliesCompetitionId } from "@/lib/football/amistosos-friendlies";

/** Competições extras que não devem ser sincronizadas pela API-Futebol. */
export function getFootballApiSyncExcludedCompetitionIds(): number[] {
  return [getAmistososFriendliesCompetitionId()];
}
