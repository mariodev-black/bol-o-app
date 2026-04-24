import { fetchProviderMatches } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";

export async function runSyncMatchesTask(force = true) {
  return syncMatchesCache({ fetchProviderMatches, force });
}
