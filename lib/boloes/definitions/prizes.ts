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
  if (rankingLength <= 0) return [];
  const sorted = [...tiers].sort((a, b) => a.rank - b.rank);
  const awards: PrizeAwardAmount[] = [];
  let fixedTotal = 0;

  for (const tier of sorted) {
    if (tier.rank > rankingLength) break;
    const fixed = Math.max(0, Math.trunc(tier.amountCents ?? 0));
    if (fixed > 0) {
      fixedTotal += fixed;
      awards.push({ rank: tier.rank, amountCents: fixed });
    }
  }

  const dynamicPool = Math.max(0, poolCents - fixedTotal);
  const dynamicTiers = sorted.filter(
    (t) => t.rank <= rankingLength && !(Math.trunc(t.amountCents ?? 0) > 0),
  );
  const totalTierBps = dynamicTiers.reduce((s, t) => s + Math.max(0, t.poolBps), 0);

  if (dynamicPool > 0 && totalTierBps > 0) {
    let allocated = 0;
    for (let i = 0; i < dynamicTiers.length; i++) {
      const tier = dynamicTiers[i]!;
      const isLast = i === dynamicTiers.length - 1;
      let amount = isLast
        ? dynamicPool - allocated
        : Math.floor((dynamicPool * tier.poolBps) / totalTierBps);
      amount = Math.max(0, amount);
      allocated += amount;
      const existing = awards.find((a) => a.rank === tier.rank);
      if (existing) {
        existing.amountCents += amount;
      } else {
        awards.push({ rank: tier.rank, amountCents: amount });
      }
    }
  }

  return awards.sort((a, b) => a.rank - b.rank);
}

export function estimatePrizePoolLabel(
  revenueCents: number,
  prizePoolBps: number,
): string | null {
  if (revenueCents <= 0) return null;
  const pool = calculateDefinitionPrizePoolCents({ prizePoolBps }, revenueCents);
  if (pool <= 0) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(pool / 100);
}
