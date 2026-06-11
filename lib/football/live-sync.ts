import { runRealtimeTick, type RealtimeTickResult } from "@/lib/football/realtime-worker";

export { LIVE_PARTIDAS_POLL_MS, partidasUrlWithLiveSync } from "@/lib/football/live-sync-client";

let lastTriggeredAt = 0;

/** Evita rajadas quando vários clientes disparam liveSync ao mesmo tempo. */
export function shouldTriggerLiveSync(minGapMs = 45_000): boolean {
  const now = Date.now();
  if (now - lastTriggeredAt < minGapMs) return false;
  lastTriggeredAt = now;
  return true;
}

export async function triggerLiveMatchSync(force = false): Promise<RealtimeTickResult | null> {
  if (!force && !shouldTriggerLiveSync()) return null;
  return runRealtimeTick();
}
