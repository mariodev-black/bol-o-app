import { runConditionalMatchesApiSync } from "@/lib/cron/tasks/conditionalMatchesSyncTask";
import { maybeRunFootballDailySnapshot } from "@/lib/cron/tasks/footballSnapshotsTask";
import { runGuaranteeResultsTask } from "@/lib/cron/tasks/guaranteeResultsTask";

export type MaintenanceTickResult = {
  sync: Awaited<ReturnType<typeof runConditionalMatchesApiSync>> | { skipped: true; reason: string };
  guarantee: Awaited<ReturnType<typeof runGuaranteeResultsTask>>;
  footballSnapshot: Awaited<ReturnType<typeof maybeRunFootballDailySnapshot>>;
};

/**
 * Um ciclo: (1) pipeline noturno tabela+fases+partidas se na janela BRT; (2) sync com API só se há pendência
 * ou cache defasado (`needsMatchApiRefreshForCron`); (3) garantia de placar + prêmios.
 * Usado pelo scheduler interno (`instrumentation.ts`) e por GET /api/cron/tick.
 */
export async function runMaintenanceTick(): Promise<MaintenanceTickResult> {
  const footballSnapshot = await maybeRunFootballDailySnapshot();
  const sync =
    footballSnapshot.ran && footballSnapshot.matchesRefreshed
      ? { skipped: true as const, reason: "nightly-football-pipeline" as const }
      : await runConditionalMatchesApiSync();
  const guarantee = await runGuaranteeResultsTask();
  return { sync, guarantee, footballSnapshot };
}
