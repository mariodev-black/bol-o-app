import { runMaintenanceTick } from "@/lib/cron/maintenance-tick";
import { cronTickLog } from "@/lib/cron/cron-tick-log";
import { runFootballSnapshotsIfCacheMissing } from "@/lib/cron/tasks/footballSnapshotsTask";

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

/**
 * Cron interno idempotente: no mesmo processo Node so inicializa uma vez
 * (instrumentation + InternalCronBootstrap no layout podem chamar em paralelo).
 */
export function startInternalCronScheduler(): CronHandle {
  if (globalThis.__bolaoCronHandle) return globalThis.__bolaoCronHandle;

  const enabled = boolEnv("INTERNAL_CRON_ENABLED", internalCronDefaultEnabled());
  const runOnVercel = boolEnv("INTERNAL_CRON_RUN_ON_VERCEL", false);
  const vercelBlocks = Boolean(process.env.VERCEL && !runOnVercel);
  const tickSeconds = intEnv(
    "INTERNAL_CRON_TICK_SECONDS",
    intEnv("INTERNAL_CRON_SYNC_MATCHES_SECONDS", 300)
  );
  const intervalMs = tickSeconds * 1000;

  let intervalHandle: ReturnType<typeof setInterval> | undefined;
  const handle: CronHandle = {
    started: false,
    stop: () => {
      if (intervalHandle !== undefined) clearInterval(intervalHandle);
    },
  };
  globalThis.__bolaoCronHandle = handle;

  if (!enabled) {
    console.warn(
      "[internal-cron] desligado (INTERNAL_CRON_ENABLED=false). Use GET /api/cron/tick com CRON_SECRET ou ligue o env."
    );
    return handle;
  }
  if (vercelBlocks) {
    console.warn("[internal-cron] desligado em VERCEL (INTERNAL_CRON_RUN_ON_VERCEL!=true).");
    return handle;
  }

  let running = false;
  const runNow = async () => {
    if (running) {
      cronTickLog("internal-interval-skipped", { reason: "overlap-previous-tick" });
      return;
    }
    running = true;
    try {
      await runMaintenanceTick();
    } catch (error) {
      console.error("[internal-cron] maintenance tick failed", error);
    } finally {
      running = false;
    }
  };

  const beginScheduledTicks = () => {
    if (intervalHandle !== undefined) return;
    intervalHandle = setInterval(() => {
      void runNow();
    }, intervalMs);
  };

  if (!globalThis.__bolaoWarmupStarted) {
    globalThis.__bolaoWarmupStarted = true;
    void (async () => {
      try {
        console.info(
          "[internal-cron] warmup: snapshot se necessario + primeiro ciclo completo (sem disputar lock com o intervalo)"
        );
        await runFootballSnapshotsIfCacheMissing();
        await runMaintenanceTick();
        cronTickLog("internal-warmup-done", { ok: true });
      } catch (error) {
        console.error("[internal-cron] initial warmup failed", error);
      } finally {
        beginScheduledTicks();
      }
    })();
  } else {
    beginScheduledTicks();
  }

  handle.started = true;
  console.info(`[internal-cron] ativo — tick a cada ${tickSeconds}s (maintenance + sync condicional + premios)`);
  return handle;
}
