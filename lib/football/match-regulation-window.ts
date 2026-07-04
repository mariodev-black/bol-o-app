/**
 * Janela de tempo regulamentar do jogo (90 min) — fonte única para worker, UI ao vivo,
 * vitrine de bolões e margem de fechamento de prêmios diários.
 */

function parseMinutesEnv(names: string[], fallback: number, min: number, max: number): number {
  for (const name of names) {
    const raw = (process.env[name] ?? "").trim();
    if (!raw) continue;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  }
  return fallback;
}

const REGULATION_ENV_KEYS = ["MATCH_REGULATION_MINUTES", "REALTIME_WORKER_WINDOW_MINUTES"] as const;

/** Minutos de jogo considerados na janela ao vivo / polling da API. Default: 90. */
export function matchRegulationMinutes(): number {
  return parseMinutesEnv([...REGULATION_ENV_KEYS], 90, 45, 150);
}

/** Alias usado pelo worker ao vivo (mesma janela regulamentar). */
export function realtimeWorkerWindowMinutes(): number {
  return matchRegulationMinutes();
}

export function matchRegulationWindowMs(): number {
  return matchRegulationMinutes() * 60_000;
}

/** Margem após o apito do último jogo do dia para fechar bolão diário. Default: 90 min. */
export function prizeDailyGraceAfterLastKickoffMinutes(): number {
  return parseMinutesEnv(
    ["PRIZE_DAILY_GRACE_AFTER_LAST_KICKOFF_MINUTES", ...REGULATION_ENV_KEYS],
    90,
    0,
    600,
  );
}

/** Partida ainda dentro da janela regulamentar após o apito. */
export function isWithinMatchRegulationWindow(
  kickoffAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!kickoffAt) return false;
  const ko = new Date(kickoffAt).getTime();
  if (!Number.isFinite(ko) || nowMs < ko) return false;
  return nowMs <= ko + matchRegulationWindowMs();
}

export function isPastMatchRegulationWindow(
  kickoffAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!kickoffAt) return false;
  const ko = new Date(kickoffAt).getTime();
  if (!Number.isFinite(ko)) return false;
  return nowMs > ko + matchRegulationWindowMs();
}
