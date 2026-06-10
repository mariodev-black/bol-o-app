/**
 * Arquitetura v2 — Scheduler interno (single-process, idempotente).
 *
 *   - Startup:          syncAllConfiguredIfStale() — popula cache se vazio.
 *   - Daily full sync:  todo dia BRT entre 00:01 e 00:30 (uma execucao por data).
 *   - Realtime worker:  setInterval a cada REALTIME_WORKER_INTERVAL_SECONDS (default 60s).
 *
 * Em Vercel/serverless: ignorado por padrao (use cron HTTP — ver app/api/cron/...).
 * Em PM2/VM/Node tradicional: liga sozinho.
 */

import { runRealtimeTick } from "@/lib/football/realtime-worker";
import {
  syncAllConfigured,
  syncAllConfiguredIfStale,
} from "@/lib/football/sync-orchestrator";

type SchedulerHandle = {
  started: boolean;
  stop: () => void;
};

declare global {
  var __bolaoSchedulerV2: SchedulerHandle | undefined;
  var __bolaoSchedulerV2DailyDate: string | undefined;
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

function brtYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function brtHm(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10),
    minute: Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10),
  };
}

function inDailyWindow(): boolean {
  // janela 00:01-00:30 BRT — primeiro tick depois das 00h pega o full sync.
  const { hour, minute } = brtHm();
  return hour === 0 && minute >= 1 && minute <= 30;
}

/**
 * Roda o full sync diario uma unica vez por data BRT. Idempotente: o segundo
 * chamador no mesmo dia ve `__bolaoSchedulerV2DailyDate` e nao chama de novo.
 */
export async function maybeRunDailyFullSync(opts?: { force?: boolean }): Promise<
  | { ran: false; reason: string }
  | { ran: true; date: string; durationMs: number }
> {
  const today = brtYmd();
  if (!opts?.force) {
    if (globalThis.__bolaoSchedulerV2DailyDate === today) {
      return { ran: false, reason: "ja-executou-hoje" };
    }
    if (!inDailyWindow()) {
      return { ran: false, reason: "fora-da-janela-00:01-00:30-brt" };
    }
  }
  const t0 = Date.now();
  try {
    await syncAllConfigured();
    globalThis.__bolaoSchedulerV2DailyDate = today;
    return { ran: true, date: today, durationMs: Date.now() - t0 };
  } catch (err) {
    console.error("[scheduler-v2] daily full sync falhou:", err);
    return { ran: false, reason: "erro" };
  }
}

/**
 * Start (idempotente) do scheduler interno. Roda:
 *   - warmup imediato: syncAllConfiguredIfStale() em background;
 *   - tick a cada REALTIME_WORKER_INTERVAL_SECONDS (default 60s).
 *     Cada tick: (a) maybeRunDailyFullSync; (b) runRealtimeTick.
 */
export function startSchedulerV2(): SchedulerHandle {
  if (globalThis.__bolaoSchedulerV2) return globalThis.__bolaoSchedulerV2;

  const handle: SchedulerHandle = {
    started: false,
    stop: () => {
      if (intervalHandle !== undefined) clearInterval(intervalHandle);
    },
  };
  let intervalHandle: ReturnType<typeof setInterval> | undefined;
  globalThis.__bolaoSchedulerV2 = handle;

  const enabled = boolEnv("INTERNAL_CRON_ENABLED", !process.env.VERCEL);
  const runOnVercel = boolEnv("INTERNAL_CRON_RUN_ON_VERCEL", false);
  if (!enabled) {
    console.warn("[scheduler-v2] desligado (INTERNAL_CRON_ENABLED=false).");
    return handle;
  }
  if (process.env.VERCEL && !runOnVercel) {
    console.warn("[scheduler-v2] desligado em VERCEL (use cron HTTP em app/api/cron).");
    return handle;
  }

  const tickSec = intEnv("REALTIME_WORKER_INTERVAL_SECONDS", 60);

  let running = false;
  const runOnce = async () => {
    if (running) return;
    running = true;
    try {
      // Daily roda primeiro — se for a janela das 00:01 BRT e ainda nao rodou hoje.
      await maybeRunDailyFullSync();
      // Worker em tempo real (so consulta partidas ATIVAS via /partidas/:id).
      await runRealtimeTick();
    } catch (err) {
      console.error("[scheduler-v2] tick falhou:", err);
    }
    // E-mail: CRM + recuperação PIX + broadcast Copa. Idempotente (locks+dedup),
    // throttle interno. Em VPS é o ÚNICO gatilho (vercel.json não roda aqui).
    try {
      const { maybeRunEmailCron } = await import("@/lib/email/internal-cron");
      await maybeRunEmailCron();
    } catch (err) {
      console.error("[scheduler-v2] email cron falhou:", err);
    } finally {
      running = false;
    }
  };

  // warmup: popula cache se vazio (1 chamada bulk) ANTES de comecar o loop.
  void (async () => {
    try {
      const r = await syncAllConfiguredIfStale();
      if (r.ran) {
        console.info(`[scheduler-v2] warmup sync (${r.reason}) — cache populado`);
      }
    } catch (err) {
      console.error("[scheduler-v2] warmup falhou:", err);
    } finally {
      intervalHandle = setInterval(() => {
        void runOnce();
      }, tickSec * 1000);
      handle.started = true;
      console.info(
        `[scheduler-v2] ativo — realtime worker a cada ${tickSec}s + daily full sync 00:01-00:30 BRT`,
      );
    }
  })();

  return handle;
}
