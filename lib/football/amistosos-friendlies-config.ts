import { getAmistososFriendliesCompetitionId } from "@/lib/football/amistosos-friendlies";
import { getSkaleBolaoCompetitionId, isSkaleBolaoEnabled } from "@/lib/boloes/skale-config";

/** Competições extras que não devem ser sincronizadas pela API-Futebol. */
export function getFootballApiSyncExcludedCompetitionIds(): number[] {
  const ids = [getAmistososFriendliesCompetitionId()];
  if (isSkaleBolaoEnabled()) ids.push(getSkaleBolaoCompetitionId());
  return ids;
}
