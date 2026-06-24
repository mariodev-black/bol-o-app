/**
 * Popup do bolão diário na home (`/`).
 * Controle: `NEXT_PUBLIC_DAILY_BOLAO_HOME_PROMO_ENABLED` (default: ativo).
 */

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

export function isDailyBolaoHomePromoEnabled(): boolean {
  return envBool("NEXT_PUBLIC_DAILY_BOLAO_HOME_PROMO_ENABLED", true);
}

const DISMISS_PREFIX = "bolao_daily_home_promo_dismissed";

export function brTodayForPromo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function dailyBolaoHomePromoDismissStorageKey(
  userId?: string | null,
  dateBR = brTodayForPromo(),
): string {
  const id = userId?.trim() || "anon";
  return `${DISMISS_PREFIX}_${id}_${dateBR}`;
}

/** Já dispensado hoje (fecha ou CTA). */
export function readDailyBolaoHomePromoDismissed(
  userId?: string | null,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(
        dailyBolaoHomePromoDismissStorageKey(userId, brTodayForPromo()),
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function persistDailyBolaoHomePromoDismissed(
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      dailyBolaoHomePromoDismissStorageKey(userId, brTodayForPromo()),
      "1",
    );
  } catch {
    /* quota / private mode */
  }
}

export const DAILY_BOLAO_HOME_PROMO_TICKETS_HREF = "/tickets-diario";
