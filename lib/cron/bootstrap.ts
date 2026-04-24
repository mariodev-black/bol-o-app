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

export function startInternalCronScheduler(): CronHandle {
  if (globalThis.__bolaoCronHandle?.started) return globalThis.__bolaoCronHandle;

  // Warmup inicial do cache ao subir a aplicação (inclusive em Vercel),
  // evitando esperar até o próximo cron diário para primeira carga.
  if (!globalThis.__bolaoWarmupStarted) {
    globalThis.__bolaoWarmupStarted = true;
    void runSyncMatchesTask(false).catch((error) => {
      console.error("[internal-cron] initial warmup failed", error);
    });
  }

  const enabled = boolEnv("INTERNAL_CRON_ENABLED", process.env.NODE_ENV !== "production");
  const runOnVercel = boolEnv("INTERNAL_CRON_RUN_ON_VERCEL", false);
  if (!enabled) {
    const handle = { started: false, stop: () => {} };
    globalThis.__bolaoCronHandle = handle;
    return handle;
  }
  if (process.env.VERCEL && !runOnVercel) {
    const handle = { started: false, stop: () => {} };
    globalThis.__bolaoCronHandle = handle;
    return handle;
  }

  const intervalSeconds = intEnv("INTERNAL_CRON_SYNC_MATCHES_SECONDS", 60);
  const intervalMs = intervalSeconds * 1000;
  let running = false;

  const runNow = async () => {
    if (running) return;
    running = true;
    try {
      await runSyncMatchesTask(true);
    } catch (error) {
      console.error("[internal-cron] sync-partidas failed", error);
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
  return handle;
}
