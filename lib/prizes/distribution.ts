export type PrizeAwardAmount = {
  rank: number;
  amountCents: number;
};

/** Pool do bolão geral e extras com data — 60% da arrecadação. */
export const PRIZE_POOL_BPS = 6000;

/** Bolão diário (Copa) — 100% da arrecadação vai para premiação. */
export const DAILY_PRIZE_POOL_BPS = 10_000;

export const DAILY_TOP_RANK_COUNT = 10;

/** Percentuais fixos do Top 10 diário (ppm; soma = 1.000.000 = 100%). */
export const DAILY_PRIZE_PERCENT_LABELS = [
  "35%",
  "20%",
  "12%",
  "8%",
  "6%",
  "5%",
  "4%",
  "4%",
  "3%",
  "3%",
] as const;

const PERCENT_SCALE = 1_000_000;

type GeneralPrizeBand = {
  from: number;
  to: number;
  weightPpm: number;
};

const GENERAL_PRIZE_BANDS: GeneralPrizeBand[] = [
  { from: 1, to: 1, weightPpm: 180_000 },
  { from: 2, to: 2, weightPpm: 90_000 },
  { from: 3, to: 3, weightPpm: 50_000 },
  { from: 4, to: 4, weightPpm: 35_000 },
  { from: 5, to: 5, weightPpm: 25_000 },
  { from: 6, to: 6, weightPpm: 18_000 },
  { from: 7, to: 7, weightPpm: 14_000 },
  { from: 8, to: 8, weightPpm: 11_000 },
  { from: 9, to: 9, weightPpm: 9_000 },
  { from: 10, to: 10, weightPpm: 7_000 },
  { from: 11, to: 20, weightPpm: 5_052 },
  { from: 21, to: 50, weightPpm: 2_500 },
  { from: 51, to: 100, weightPpm: 1_200 },
  { from: 101, to: 250, weightPpm: 600 },
  { from: 251, to: 500, weightPpm: 300 },
  { from: 501, to: 1000, weightPpm: 180 },
  { from: 1001, to: 2506, weightPpm: 80 },
];

const DAILY_PRIZE_WEIGHTS_PPM = [
  350_000,
  200_000,
  120_000,
  80_000,
  60_000,
  50_000,
  40_000,
  40_000,
  30_000,
  30_000,
] as const;

/** Legado — bolões extra por data (mantém pesos anteriores + pool 60%). */
const EXTRA_PRIZE_WEIGHTS = [
  90_000,
  45_000,
  25_000,
  18_000,
  15_000,
  12_000,
  10_000,
  9_000,
  8_000,
  7_400,
] as const;

export function calculatePrizePoolCents(
  totalRevenueCents: number,
  bolaoType: "general" | "daily" | "extra" = "general",
): number {
  const bps = bolaoType === "daily" ? DAILY_PRIZE_POOL_BPS : PRIZE_POOL_BPS;
  return Math.floor(Math.max(0, Math.trunc(totalRevenueCents)) * bps / 10000);
}

function allocateRemainder(amounts: PrizeAwardAmount[], cents: number) {
  let idx = 0;
  while (cents > 0 && amounts.length > 0) {
    amounts[idx % amounts.length]!.amountCents += 1;
    cents -= 1;
    idx += 1;
  }
}

function allocateProportionalRemainder(amounts: PrizeAwardAmount[], cents: number) {
  if (cents <= 0 || amounts.length === 0) return;
  const totalBase = amounts.reduce((sum, award) => sum + award.amountCents, 0);
  if (totalBase <= 0) {
    allocateRemainder(amounts, cents);
    return;
  }

  const additions = amounts.map((award) => {
    const raw = cents * award.amountCents / totalBase;
    const floor = Math.floor(raw);
    return { award, floor, fraction: raw - floor };
  });
  let assigned = 0;
  for (const addition of additions) {
    addition.award.amountCents += addition.floor;
    assigned += addition.floor;
  }

  additions
    .sort((a, b) => b.fraction - a.fraction || a.award.rank - b.award.rank)
    .slice(0, cents - assigned)
    .forEach((addition) => {
      addition.award.amountCents += 1;
    });
}

function calculateTop10WeightedAwards(
  poolCents: number,
  rankedCount: number,
  weights: readonly number[],
): PrizeAwardAmount[] {
  const safePool = Math.max(0, Math.trunc(poolCents));
  const eligibleCount = Math.max(0, Math.min(weights.length, Math.trunc(rankedCount)));
  if (safePool === 0 || eligibleCount === 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let assignedCents = 0;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  for (let idx = 0; idx < eligibleCount; idx += 1) {
    const rank = idx + 1;
    const amountCents = Math.floor(safePool * weights[idx]! / totalWeight);
    awards.push({ rank, amountCents });
    assignedCents += amountCents;
  }
  allocateProportionalRemainder(awards, safePool - assignedCents);
  return awards.filter((award) => award.amountCents > 0);
}

function calculateDailyPrizeAwards(poolCents: number, rankedCount: number): PrizeAwardAmount[] {
  const safePool = Math.max(0, Math.trunc(poolCents));
  const eligibleCount = Math.max(
    0,
    Math.min(DAILY_PRIZE_WEIGHTS_PPM.length, Math.trunc(rankedCount)),
  );
  if (safePool === 0 || eligibleCount === 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let assignedCents = 0;
  for (let idx = 0; idx < eligibleCount; idx += 1) {
    const rank = idx + 1;
    const amountCents = Math.floor(safePool * DAILY_PRIZE_WEIGHTS_PPM[idx]! / PERCENT_SCALE);
    awards.push({ rank, amountCents });
    assignedCents += amountCents;
  }
  allocateProportionalRemainder(awards, safePool - assignedCents);
  return awards.filter((award) => award.amountCents > 0);
}

export function calculatePrizeAwards(
  poolCents: number,
  rankedCount: number,
  bolaoType: "general" | "daily" | "extra" = "general",
): PrizeAwardAmount[] {
  if (bolaoType === "daily") {
    return calculateDailyPrizeAwards(poolCents, rankedCount);
  }
  if (bolaoType === "extra") {
    return calculateTop10WeightedAwards(poolCents, rankedCount, EXTRA_PRIZE_WEIGHTS);
  }

  const safePool = Math.max(0, Math.trunc(poolCents));
  const eligibleCount = Math.max(0, Math.min(2506, Math.trunc(rankedCount)));
  if (safePool === 0 || eligibleCount === 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let assignedCents = 0;

  for (const band of GENERAL_PRIZE_BANDS) {
    for (let rank = band.from; rank <= Math.min(band.to, eligibleCount); rank += 1) {
      const amountCents = Math.floor(safePool * band.weightPpm / PERCENT_SCALE);
      awards.push({ rank, amountCents });
      assignedCents += amountCents;
    }
  }

  allocateProportionalRemainder(awards, safePool - assignedCents);
  return awards.filter((award) => award.amountCents > 0);
}
