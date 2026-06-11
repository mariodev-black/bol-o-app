import { getAmistososFriendliesCompetitionId } from "@/lib/football/amistosos-friendlies";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { getSkaleBolaoCompetitionId, isSkaleBolaoEnabled } from "@/lib/boloes/skale-config";
function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function parseIdsFromEnv(name: string): number[] {
  const raw = env(name);
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Competições extras que não devem ser sincronizadas pela API-Futebol. */
export function getFootballApiSyncExcludedCompetitionIds(): number[] {
  const ids = [getAmistososFriendliesCompetitionId()];
  if (isSkaleBolaoEnabled()) ids.push(getSkaleBolaoCompetitionId());
  for (const id of parseIdsFromEnv("FOOTBALL_API_SYNC_EXCLUDED_COMPETITION_IDS")) {
    ids.push(id);
  }
  return [...new Set(ids)];
}

export function isFootballApiSyncExcludedCompetitionId(id: number): boolean {
  return getFootballApiSyncExcludedCompetitionIds().includes(id);
}

/** IDs que participam de bolões mas sincronizam via API-Futebol (cron/worker). */
export function getFootballApiSyncableCompetitionIds(): number[] {
  return getAllSyncedCompetitionIds().filter(
    (id) => !isFootballApiSyncExcludedCompetitionId(id),
  );
}
