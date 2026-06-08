/**
 * Premiação Bolão da Skale — 100% do valor aprovado, pago ao final da Copa.
 * 1º 60% · 2º 30% · 3º 10%
 */

import type { PrizeAwardAmount } from "@/lib/prizes/distribution";

export const SKALE_PRIZE_SHARE_BPS = {
  1: 6000,
  2: 3000,
  3: 1000,
} as const;

export const SKALE_PRIZE_SHARE_PERCENT = {
  1: 60,
  2: 30,
  3: 10,
} as const;

/** Pool = 100% da receita de cotas pagas (sem retenção da casa). */
export function calculateSkalePrizePoolCents(totalRevenueCents: number): number {
  return Math.max(0, Math.trunc(totalRevenueCents));
}

/** Top 3 — percentuais sobre a receita total aprovada. */
export function calculateSkalePrizeAwards(totalRevenueCents: number): PrizeAwardAmount[] {
  const safe = Math.max(0, Math.trunc(totalRevenueCents));
  if (safe === 0) return [];

  const awards: PrizeAwardAmount[] = (
    [1, 2, 3] as const
  ).map((rank) => ({
    rank,
    amountCents: Math.floor((safe * SKALE_PRIZE_SHARE_BPS[rank]) / 10_000),
  }));

  const assigned = awards.reduce((sum, row) => sum + row.amountCents, 0);
  const remainder = safe - assigned;
  if (remainder > 0 && awards[0]) {
    awards[0].amountCents += remainder;
  }

  return awards.filter((row) => row.amountCents > 0);
}

export function formatSkalePrizeAmountFromRevenue(
  totalRevenueCents: number,
  position: 1 | 2 | 3,
): string {
  const awards = calculateSkalePrizeAwards(totalRevenueCents);
  const row = awards.find((a) => a.rank === position);
  if (!row) return "—";
  return (row.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const SKALE_PRIZE_RULES_COPY =
  "1º lugar 60% · 2º lugar 30% · 3º lugar 10% do valor arrecadado. Premiação liberada ao final da Copa.";

export const SKALE_PRIZE_FIRST_PLACE_LINE =
  "Bolão Skale: 1º 60% · 2º 30% · 3º 10% do total arrecadado — pagamento ao final da Copa.";
