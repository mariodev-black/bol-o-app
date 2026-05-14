import { cronTickLog } from "@/lib/cron/cron-tick-log";
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
export async function runGuaranteeResultsTask(opts?: { tickId?: string }): Promise<GuaranteeResultsTaskResult> {
  const tickId = opts?.tickId;
  const prizeLog = { tickId, source: "guarantee-cron" as const };

  const forcedSync = await needsForcedResultSync();
  cronTickLog("guarantee-forced-check", { tickId, forcedSync });

  let sync: Awaited<ReturnType<typeof syncMatchesCache>> | null = null;
  if (forcedSync) {
    cronTickLog("guarantee-sync-execute", { tickId });
    sync = await syncMatchesCache({
      fetchProviderMatches: fetchProviderMatchesForAllSyncedCompetitions,
      force: true,
      cronTrace: "guarantee-forced-sync",
      tickId,
    });
    cronTickLog("guarantee-sync-result", { tickId, ...sync });
  } else {
    cronTickLog("guarantee-sync-skip", { tickId, reason: "sem-forced-result-sync" });
  }

  cronTickLog("guarantee-prize-closures-start", { tickId });
  await processPrizeClosuresAfterMatchSync(prizeLog);
  cronTickLog("guarantee-prize-closures-finish", { tickId });

  return { forcedSync, sync };
}
