export type PrizeBand = {
  from: number;
  to: number;
  poolBps: number;
  weightsBps?: Record<number, number>;
};

export type PrizeAwardAmount = {
  rank: number;
  amountCents: number;
};

export const PRIZE_POOL_BPS = 6000;

const PRIZE_BANDS: PrizeBand[] = [
  {
    from: 1,
    to: 10,
    poolBps: 4500,
    weightsBps: {
      1: 1800,
      2: 800,
      3: 500,
      4: 350,
      5: 280,
      6: 220,
      7: 170,
      8: 140,
      9: 120,
      10: 120,
    },
  },
  { from: 11, to: 50, poolBps: 1300 },
  { from: 51, to: 500, poolBps: 1700 },
  { from: 501, to: 5000, poolBps: 1500 },
  { from: 5001, to: 10000, poolBps: 1000 },
];

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

export function calculatePrizeAwards(poolCents: number, rankedCount: number): PrizeAwardAmount[] {
  const safePool = Math.max(0, Math.trunc(poolCents));
  const eligibleCount = Math.max(0, Math.min(10000, Math.trunc(rankedCount)));
  if (safePool === 0 || eligibleCount === 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let assignedCents = 0;

  for (const band of PRIZE_BANDS) {
    const winnersInBand = Math.max(0, Math.min(eligibleCount, band.to) - band.from + 1);
    if (winnersInBand === 0) continue;

    const bandCents = Math.floor(safePool * band.poolBps / 10000);
    if (band.weightsBps) {
      for (let rank = band.from; rank <= Math.min(band.to, eligibleCount); rank += 1) {
        const amountCents = Math.floor(safePool * (band.weightsBps[rank] ?? 0) / 10000);
        awards.push({ rank, amountCents });
        assignedCents += amountCents;
      }
      continue;
    }

    const perWinner = Math.floor(bandCents / winnersInBand);
    const startLength = awards.length;
    for (let rank = band.from; rank <= Math.min(band.to, eligibleCount); rank += 1) {
      awards.push({ rank, amountCents: perWinner });
      assignedCents += perWinner;
    }
    allocateRemainder(awards.slice(startLength), bandCents - perWinner * winnersInBand);
    assignedCents += bandCents - perWinner * winnersInBand;
  }

  allocateProportionalRemainder(awards, safePool - assignedCents);
  return awards.filter((award) => award.amountCents > 0);
}
