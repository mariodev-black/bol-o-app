/**
 * Bolão Copa – Sábado e Domingo. Pool separado (comp sintético próprio) com os
 * jogos da Copa (id 72) disputados em SÁBADO e DOMINGO. Premiação 60/30/10, 100%.
 * Reaproveita o mesmo pipeline do bolão Skale (preço fixo + prêmio por pool).
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

/** ID sintético em matches_cache / tickets.extra_championship_id. */
export function getWeekendBolaoCompetitionId(): number {
  return envInt("WEEKEND_BOLAO_COMPETITION_ID", 90008);
}

export function getWeekendBolaoSourceCopaCompetitionId(): number {
  const fromEnv = envInt("WEEKEND_BOLAO_SOURCE_COMPETITION_ID", 0);
  return fromEnv > 0 ? fromEnv : getFootballMainCompetitionId();
}

/** R$ 100,00 por inscrição. */
export function getWeekendBolaoUnitCents(): number {
  return envInt("WEEKEND_BOLAO_UNIT_CENTS", 10_000);
}

export const WEEKEND_BOLAO_DISPLAY_NAME = "Bolão Copa – Sábado e Domingo";

export const WEEKEND_BOLAO_SUBTITLE =
  "Todos os jogos da Copa de sábado e domingo — premiação 100% (60/30/10)";

export const WEEKEND_BOLAO_SCOPE_LABEL = "Rodada do fim de semana";

export function isWeekendBolaoEnabled(): boolean {
  const s = env("WEEKEND_BOLAO_ENABLED").toLowerCase();
  if (!s) return true;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function isWeekendBolaoCompetition(
  championshipId: number | undefined | null,
): boolean {
  if (!isWeekendBolaoEnabled()) return false;
  const id =
    championshipId != null && Number.isFinite(Number(championshipId))
      ? Number(championshipId)
      : NaN;
  return !Number.isNaN(id) && id > 0 && id === getWeekendBolaoCompetitionId();
}
