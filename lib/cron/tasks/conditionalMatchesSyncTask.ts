import { cronTickLog } from "@/lib/cron/cron-tick-log";
import { getMatchApiRefreshBreakdown } from "@/lib/cron/match-result-guarantee";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { fetchProviderMatchesForAllSyncedCompetitions } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";

/**
 * Sync com API Futebol só quando o cron detecta pendência (garantia de placar) ou cache defasado.
 * Rotas consumidas pelo browser não chamam isto — leem só `matches_cache`.
 */
export async function runConditionalMatchesApiSync(opts?: { tickId?: string }) {
  const tickId = opts?.tickId;
  const competitionIds = getAllSyncedCompetitionIds();
  const breakdown = await getMatchApiRefreshBreakdown();
  cronTickLog("api-refresh-breakdown", {
    tickId,
    competitionIds,
    needsRefresh: breakdown.needsRefresh,
    forcedResultSync: breakdown.forcedResultSync,
    staleCache: breakdown.staleCache,
  });

  if (!breakdown.needsRefresh) {
    const out = { refreshed: false as const, reason: "cron-sem-pendencias-api" as const };
    cronTickLog("conditional-sync-skip", { tickId, ...out });
    return out;
  }

  if (["1", "true", "yes"].includes((process.env.DEBUG_MATCHES_SYNC || "").trim().toLowerCase())) {
    console.info("[internal-cron] sync partidas na API (pendencia ou cache > N min em jogo recente)");
  }

  cronTickLog("conditional-sync-execute", { tickId });
  const result = await syncMatchesCache({
    fetchProviderMatches: fetchProviderMatchesForAllSyncedCompetitions,
    force: true,
    cronTrace: "conditional-api-sync",
    tickId,
  });
  cronTickLog("conditional-sync-result", { tickId, ...result });
  return result;
}
