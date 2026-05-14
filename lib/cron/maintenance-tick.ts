import { randomUUID } from "node:crypto";
import { cronTickLog } from "@/lib/cron/cron-tick-log";
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
  const tickId = randomUUID();
  const t0 = Date.now();
  cronTickLog("maintenance-start", { tickId });

  try {
    const footballSnapshot = await maybeRunFootballDailySnapshot();
    cronTickLog("football-snapshot", { tickId, ...footballSnapshot });

    let sync: MaintenanceTickResult["sync"];
    if (footballSnapshot.ran && footballSnapshot.matchesRefreshed) {
      cronTickLog("conditional-sync-skipped", {
        tickId,
        reason: "nightly-football-pipeline",
      });
      sync = { skipped: true as const, reason: "nightly-football-pipeline" as const };
    } else {
      sync = await runConditionalMatchesApiSync({ tickId });
    }

    cronTickLog("guarantee-phase-start", { tickId });
    const guarantee = await runGuaranteeResultsTask({ tickId });
    cronTickLog("guarantee-phase-end", {
      tickId,
      forcedSync: guarantee.forcedSync,
      syncRefreshed: guarantee.sync?.refreshed ?? null,
      syncReason: guarantee.sync?.reason ?? null,
      syncCount: guarantee.sync && "count" in guarantee.sync ? guarantee.sync.count : null,
    });

    const result: MaintenanceTickResult = { sync, guarantee, footballSnapshot };
    cronTickLog("maintenance-end", {
      tickId,
      ok: true,
      ms: Date.now() - t0,
      sync: summarizeSyncForLog(sync),
    });
    return result;
  } catch (error) {
    cronTickLog("maintenance-error", {
      tickId,
      ms: Date.now() - t0,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function summarizeSyncForLog(sync: MaintenanceTickResult["sync"]): Record<string, unknown> {
  if ("skipped" in sync && sync.skipped) {
    return { skipped: true, reason: sync.reason };
  }
  return {
    skipped: false,
    refreshed: sync.refreshed,
    reason: sync.reason,
    ...("count" in sync && sync.count != null ? { count: sync.count } : {}),
  };
}
