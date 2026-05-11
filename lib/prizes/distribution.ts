export type PrizeAwardAmount = {
  rank: number;
  amountCents: number;
};

export const PRIZE_POOL_BPS = 6000;

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

const DAILY_PRIZE_WEIGHTS = [
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

export function calculatePrizePoolCents(totalRevenueCents: number): number {
  return Math.floor(Math.max(0, Math.trunc(totalRevenueCents)) * PRIZE_POOL_BPS / 10000);
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

export function calculatePrizeAwards(
  poolCents: number,
  rankedCount: number,
  bolaoType: "general" | "daily" = "general"
): PrizeAwardAmount[] {
  const safePool = Math.max(0, Math.trunc(poolCents));
  const maxRank = bolaoType === "daily" ? DAILY_PRIZE_WEIGHTS.length : 2506;
  const eligibleCount = Math.max(0, Math.min(maxRank, Math.trunc(rankedCount)));
  if (safePool === 0 || eligibleCount === 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let assignedCents = 0;

  if (bolaoType === "daily") {
    const totalWeight = DAILY_PRIZE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
    for (let idx = 0; idx < eligibleCount; idx += 1) {
      const rank = idx + 1;
      const amountCents = Math.floor(safePool * DAILY_PRIZE_WEIGHTS[idx]! / totalWeight);
      awards.push({ rank, amountCents });
      assignedCents += amountCents;
    }
    allocateProportionalRemainder(awards, safePool - assignedCents);
    return awards.filter((award) => award.amountCents > 0);
  }

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
