import { getAmistososFriendliesCompetitionId } from "@/lib/football/amistosos-friendlies";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { getSkaleBolaoCompetitionId, isSkaleBolaoEnabled } from "@/lib/boloes/skale-config";
import {
  getWeekendBolaoCompetitionId,
  isWeekendBolaoEnabled,
} from "@/lib/boloes/weekend-bolao-config";
import { getChampionsChampionshipId } from "@/lib/boloes-outros-grid";

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

/**
 * Competições extras que NÃO devem ser sincronizadas pela API-Futebol.
 * Champions League (card de branding) não está no plano da API → retorna 401;
 * fica só como card no grid, sem sync.
 */
export function getFootballApiSyncExcludedCompetitionIds(): number[] {
  const ids = [getAmistososFriendliesCompetitionId(), getChampionsChampionshipId()];
  if (isSkaleBolaoEnabled()) ids.push(getSkaleBolaoCompetitionId());
  if (isWeekendBolaoEnabled()) ids.push(getWeekendBolaoCompetitionId());
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
