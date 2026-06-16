/**
 * Bolão Diário Skale — mesmas edições/dias da Copa (`GROUP_STAGE_DAILY_EDITIONS`),
 * pool sintético separado (comp 90009), R$ 100/cota.
 */

import {
  dailyEditionCardTitle,
  dailyEditionLabel,
  formatDailyEditionCardSubtitle,
  formatDailyEditionDatesLabel,
  isValidDailyEditionNumber,
  listGroupStageDailyEditions,
  paidTicketDailyEditionNumber,
} from "@/lib/boloes/daily-editions";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(env(name) || String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** ID sintético — não confundir com Skale integral (90007) nem FDS (90008). */
export function getSkaleDailyBolaoCompetitionId(): number {
  return envInt("SKALE_DAILY_BOLAO_COMPETITION_ID", 90009);
}

export function getSkaleDailyBolaoUnitCents(): number {
  return envInt("SKALE_DAILY_BOLAO_UNIT_CENTS", 10_000);
}

export const SKALE_DAILY_BOLAO_DISPLAY_NAME = "Bolão Diário Skale";

export const SKALE_DAILY_BOLAO_SUBTITLE =
  "Copa do Mundo 2026 — edições diárias exclusivas Skale";

export function isSkaleDailyBolaoEnabled(): boolean {
  const s = env("SKALE_DAILY_BOLAO_ENABLED").toLowerCase();
  if (!s) return true;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function isSkaleDailyBolaoCompetition(
  championshipId: number | undefined | null,
): boolean {
  if (!isSkaleDailyBolaoEnabled()) return false;
  const id =
    championshipId != null && Number.isFinite(Number(championshipId))
      ? Number(championshipId)
      : NaN;
  return !Number.isNaN(id) && id > 0 && id === getSkaleDailyBolaoCompetitionId();
}

export function skaleDailyEditionLabel(number: number): string {
  return `Bolão Diário Skale #${number}`;
}

export function skaleDailyEditionCardTitle(number: number): string {
  return `Diário Skale ${String(number).padStart(2, "0")}`;
}

export function paidTicketSkaleDailyEditionNumber(ticket: {
  ticketType?: string;
  extraChampionshipId?: number | null;
  round_number?: number | null;
  extraRoundNumber?: number | null;
  skaleDailyEditionNumber?: number | null;
}): number | null {
  if (ticket.skaleDailyEditionNumber != null) {
    const n = Number(ticket.skaleDailyEditionNumber);
    return isValidDailyEditionNumber(n) ? n : null;
  }
  if (ticket.ticketType !== "extra") return null;
  if (!isSkaleDailyBolaoCompetition(ticket.extraChampionshipId)) return null;
  const raw =
    ticket.extraRoundNumber != null
      ? ticket.extraRoundNumber
      : ticket.round_number;
  return paidTicketDailyEditionNumber({
    ticketType: "daily",
    round_number: raw,
  });
}

export {
  dailyEditionCardTitle,
  dailyEditionLabel,
  formatDailyEditionCardSubtitle,
  formatDailyEditionDatesLabel,
  listGroupStageDailyEditions,
};
