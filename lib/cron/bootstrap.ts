import { runMaintenanceTick } from "@/lib/cron/maintenance-tick";
import { runFootballSnapshotsIfCacheMissing } from "@/lib/cron/tasks/footballSnapshotsTask";
import { runGuaranteeResultsTask } from "@/lib/cron/tasks/guaranteeResultsTask";
import { runSyncMatchesTask } from "@/lib/cron/tasks/syncMatchesTask";

type CronHandle = {
  started: boolean;
  stop: () => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __bolaoCronHandle: CronHandle | undefined;
  // eslint-disable-next-line no-var
  var __bolaoWarmupStarted: boolean | undefined;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function intEnv(name: string, fallback: number): number {
  const raw = Number.parseInt((process.env[name] || "").trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Em Vercel o processo nao fica vivo para intervalos longos; fora dali o default e ligado. */
function internalCronDefaultEnabled(): boolean {
  return !process.env.VERCEL;
}

export function startInternalCronScheduler(): CronHandle {
  if (globalThis.__bolaoCronHandle?.started) return globalThis.__bolaoCronHandle;

  if (!globalThis.__bolaoWarmupStarted) {
    globalThis.__bolaoWarmupStarted = true;
    void (async () => {
      try {
        console.info("[internal-cron] warmup: snapshot se necessario + sync partidas + garantia");
        await runFootballSnapshotsIfCacheMissing();
        await runSyncMatchesTask(true);
        await runGuaranteeResultsTask();
      } catch (error) {
        console.error("[internal-cron] initial warmup failed", error);
      }
    })();
  }

  const enabled = boolEnv("INTERNAL_CRON_ENABLED", internalCronDefaultEnabled());
  const runOnVercel = boolEnv("INTERNAL_CRON_RUN_ON_VERCEL", false);
  if (!enabled) {
    const handle = { started: false, stop: () => {} };
    globalThis.__bolaoCronHandle = handle;
    console.warn("[internal-cron] desligado (INTERNAL_CRON_ENABLED=false). Use GET /api/cron/tick com CRON_SECRET ou ligue o env.");
    return handle;
  }
  if (process.env.VERCEL && !runOnVercel) {
    const handle = { started: false, stop: () => {} };
    globalThis.__bolaoCronHandle = handle;
    console.warn("[internal-cron] desligado em VERCEL (INTERNAL_CRON_RUN_ON_VERCEL!=true).");
    return handle;
  }

  const tickSeconds = intEnv(
    "INTERNAL_CRON_TICK_SECONDS",
    intEnv("INTERNAL_CRON_SYNC_MATCHES_SECONDS", 300)
  );
  const intervalMs = tickSeconds * 1000;
  let running = false;

  const runNow = async () => {
    if (running) return;
    running = true;
    try {
      await runMaintenanceTick();
    } catch (error) {
      console.error("[internal-cron] maintenance tick failed", error);
    } finally {
      running = false;
    }
  };

  void runNow();
  const timer = setInterval(() => {
    void runNow();
  }, intervalMs);

  const handle: CronHandle = {
    started: true,
    stop: () => clearInterval(timer),
  };
  globalThis.__bolaoCronHandle = handle;
  console.info(`[internal-cron] ativo — tick a cada ${tickSeconds}s (maintenance + sync condicional + premios)`);
  return handle;
}
