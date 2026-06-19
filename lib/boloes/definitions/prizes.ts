import type { BolaoDefinition, BolaoPrizeTier } from "@/lib/boloes/definitions/types";
import type { PrizeAwardAmount } from "@/lib/prizes/distribution";

export function calculateDefinitionPrizePoolCents(
  def: Pick<BolaoDefinition, "prizePoolBps">,
  totalRevenueCents: number,
): number {
  const bps = Math.max(0, Math.min(10000, def.prizePoolBps));
  return Math.floor(Math.max(0, Math.trunc(totalRevenueCents)) * bps / 10000);
}

export function calculateDefinitionPrizeAwards(
  poolCents: number,
  rankingLength: number,
  tiers: BolaoPrizeTier[],
): PrizeAwardAmount[] {
  if (poolCents <= 0 || rankingLength <= 0) return [];
  const sorted = [...tiers].sort((a, b) => a.rank - b.rank);
  const totalTierBps = sorted.reduce((s, t) => s + Math.max(0, t.poolBps), 0);
  if (totalTierBps <= 0) return [];

  const awards: PrizeAwardAmount[] = [];
  let allocated = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i]!;
    if (tier.rank > rankingLength) break;
    const isLast = i === sorted.length - 1;
    let amount = isLast
      ? poolCents - allocated
      : Math.floor((poolCents * tier.poolBps) / totalTierBps);
    amount = Math.max(0, amount);
    allocated += amount;
    awards.push({ rank: tier.rank, amountCents: amount });
  }
  return awards;
}
