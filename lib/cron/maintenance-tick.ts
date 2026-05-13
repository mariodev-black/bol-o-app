import { runGuaranteeResultsTask } from "@/lib/cron/tasks/guaranteeResultsTask";
import { runSyncMatchesTask } from "@/lib/cron/tasks/syncMatchesTask";

export type MaintenanceTickResult = {
  sync: Awaited<ReturnType<typeof runSyncMatchesTask>>;
  guarantee: Awaited<ReturnType<typeof runGuaranteeResultsTask>>;
};

/**
 * Um ciclo completo: sync leve da cache (respeita TTL/locks) + garantia de placar + fechamento idempotente de premios.
 * Usado pelo scheduler interno (instrumentation) e por GET /api/cron/tick.
 */
export async function runMaintenanceTick(): Promise<MaintenanceTickResult> {
  const sync = await runSyncMatchesTask(false);
  const guarantee = await runGuaranteeResultsTask();
  return { sync, guarantee };
}
