/** Resposta de GET /api/affiliate/summary (campo `summary`). */

export type ReferralTierId = "bronze" | "silver" | "gold" | "diamond";

export type AffiliateSummary = {
  config: {
    rewardBronzeCents: number;
    rewardSilverCents: number;
    rewardGoldCents: number;
    rewardDiamondCents: number;
    tierSilverMinCommissions: number;
    tierGoldMinCommissions: number;
    tierDiamondMinCommissions: number;
  };
  paidReferralsCount: number;
  signupReferralsCount: number;
  currentTier: ReferralTierId;
  currentTierLabel: string;
  nextRewardCents: number;
  balances: {
    totalEarnedCents: number;
    pendingWithdrawalCents: number;
    completedWithdrawalCents: number;
    availableCents: number;
  };
  pendingSignupReferrals: Array<{ id: string; name: string | null; createdAt: string }>;
  /** Mínimo para solicitar saque (centavos), do servidor. */
  minWithdrawalCents: number;
  commissionActivity: Array<{
    id: string;
    referredUserId: string;
    referredName: string | null;
    amountCents: number;
    tier: ReferralTierId;
    commissionIndex: number;
    createdAt: string;
  }>;
};

export function formatBRLFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function rewardCentsForCommissionIndex(cfg: AffiliateSummary["config"], index: number): number {
  if (index >= cfg.tierDiamondMinCommissions) return cfg.rewardDiamondCents;
  if (index >= cfg.tierGoldMinCommissions) return cfg.rewardGoldCents;
  if (index >= cfg.tierSilverMinCommissions) return cfg.rewardSilverCents;
  return cfg.rewardBronzeCents;
}

export function simulateTotalForNewPaidReferrals(
  cfg: AffiliateSummary["config"],
  currentPaidCount: number,
  extraCount: number
): number {
  let total = 0;
  for (let i = 1; i <= extraCount; i++) {
    total += rewardCentsForCommissionIndex(cfg, currentPaidCount + i);
  }
  return total;
}
