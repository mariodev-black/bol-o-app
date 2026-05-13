import { needsForcedResultSync } from "@/lib/cron/match-result-guarantee";
import { fetchProviderMatchesForAllSyncedCompetitions } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";
import { processPrizeClosuresAfterMatchSync } from "@/lib/prizes/processor";

export type GuaranteeResultsTaskResult = {
  forcedSync: boolean;
  sync: Awaited<ReturnType<typeof syncMatchesCache>> | null;
};

/**
 * Cron de garantia: (1) se o DB indicar atraso (palpite + carencia em horas, ou apito + minutos no relogio,
 * ou encerrado sem placar), forca sync com a API; (2) sempre roda fechamento idempotente de premios.
 */
export async function runGuaranteeResultsTask(): Promise<GuaranteeResultsTaskResult> {
  const forcedSync = await needsForcedResultSync();
  let sync: Awaited<ReturnType<typeof syncMatchesCache>> | null = null;
  if (forcedSync) {
    sync = await syncMatchesCache({ fetchProviderMatches: fetchProviderMatchesForAllSyncedCompetitions, force: true });
  }
  await processPrizeClosuresAfterMatchSync();
  return { forcedSync, sync };
}
