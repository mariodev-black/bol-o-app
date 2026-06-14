/**
 * Bolão da Skale — pool premium separado com jogos da Copa (API id 72).
 * Partidas espelhadas em um `competition_id` sintético para ranking isolado.
 */

import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(env(name) || String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** ID sintético em `matches_cache` / tickets.extra_championship_id. */
export function getSkaleBolaoCompetitionId(): number {
  return envInt("SKALE_BOLAO_COMPETITION_ID", 90007);
}

export function getSkaleBolaoSourceCopaCompetitionId(): number {
  const fromEnv = envInt("SKALE_BOLAO_SOURCE_COMPETITION_ID", 0);
  return fromEnv > 0 ? fromEnv : getFootballMainCompetitionId();
}

export function getSkaleBolaoUnitCents(): number {
  return envInt("SKALE_BOLAO_UNIT_CENTS", 50_000);
}

export const SKALE_BOLAO_DISPLAY_NAME = "Bolão Skale";

export const SKALE_BOLAO_SUBTITLE =
  "Copa do Mundo 2026 — pool exclusivo Skale";

/** Rótulo do escopo na vitrine/ranking — todos os jogos da Copa (não é bolão do dia). */
export const SKALE_BOLAO_SCOPE_LABEL = "Copa do Mundo 2026";

export function isSkaleBolaoEnabled(): boolean {
  const s = env("SKALE_BOLAO_ENABLED").toLowerCase();
  if (!s) return true;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function isSkaleBolaoCompetition(
  championshipId: number | undefined | null,
): boolean {
  if (!isSkaleBolaoEnabled()) return false;
  const id =
    championshipId != null && Number.isFinite(Number(championshipId))
      ? Number(championshipId)
      : NaN;
  return !Number.isNaN(id) && id > 0 && id === getSkaleBolaoCompetitionId();
}
