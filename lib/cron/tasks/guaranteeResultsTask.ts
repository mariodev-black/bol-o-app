import { needsForcedResultSync } from "@/lib/cron/match-result-guarantee";
import { fetchProviderMatches } from "@/lib/football-api";
import { syncMatchesCache } from "@/lib/matches-cache";
import { processPrizeClosuresAfterMatchSync } from "@/lib/prizes/processor";

export type GuaranteeResultsTaskResult = {
  forcedSync: boolean;
  sync: Awaited<ReturnType<typeof syncMatchesCache>> | null;
};

/**
 * Cron de garantia: (1) se houver partida com palpite ainda sem resultado apos o tempo de carencia,
 * forca sync com a API externa; (2) sempre tenta fechar premios (idempotente) para nenhum bilhete ficar sem processamento.
 */
export async function runGuaranteeResultsTask(): Promise<GuaranteeResultsTaskResult> {
  const forcedSync = await needsForcedResultSync();
  let sync: Awaited<ReturnType<typeof syncMatchesCache>> | null = null;
  if (forcedSync) {
    sync = await syncMatchesCache({ fetchProviderMatches, force: true });
  }
  await processPrizeClosuresAfterMatchSync();
  return { forcedSync, sync };
}
