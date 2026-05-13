import { needsMatchApiRefreshForCron } from "@/lib/cron/match-result-guarantee";
import { fetchProviderMatches } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";

/**
 * Sync com API Futebol só quando o cron detecta pendência (garantia de placar) ou cache defasado.
 * Rotas consumidas pelo browser não chamam isto — leem só `matches_cache`.
 */
export async function runConditionalMatchesApiSync() {
  if (!(await needsMatchApiRefreshForCron())) {
    return { refreshed: false as const, reason: "cron-sem-pendencias-api" as const };
  }
  return syncMatchesCache({ fetchProviderMatches, force: true });
}
