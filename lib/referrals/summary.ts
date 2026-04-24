import {
  currentTierFromPaidCount,
  getReferralProgramConfig,
  nextRewardCents,
  tierLabelPt,
  type ReferralTierId,
} from "@/lib/referrals/config";
import {
  countPaidReferralsForReferrer,
  getAffiliateBalances,
  listCommissionActivityForReferrer,
} from "@/lib/referrals/commissions";
import type { ReferredUserSummary } from "@/lib/auth/users";
import { minAffiliateWithdrawalCents } from "@/lib/referrals/withdraw";

export type AffiliateSummaryPayload = {
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
  /** Cadastros que ainda não geraram comissão (nenhum ticket pago vinculado). */
  pendingSignupReferrals: ReferredUserSummary[];
  minWithdrawalCents: number;
  commissionActivity: Awaited<ReturnType<typeof listCommissionActivityForReferrer>>;
};

export async function buildAffiliateSummaryForUser(
  referrerUserId: string,
  signups: ReferredUserSummary[]
): Promise<AffiliateSummaryPayload> {
  const cfg = getReferralProgramConfig();
  const paidCount = await countPaidReferralsForReferrer(referrerUserId);
  const balances = await getAffiliateBalances(referrerUserId);
  const activity = await listCommissionActivityForReferrer(referrerUserId, 40);

  const paidReferredIds = new Set(activity.map((a) => a.referredUserId));
  const pendingSignupReferrals = signups.filter((s) => !paidReferredIds.has(s.id));

  const currentTier = currentTierFromPaidCount(cfg, paidCount);
  const next = nextRewardCents(cfg, paidCount);

  return {
    config: {
      rewardBronzeCents: cfg.rewardBronzeCents,
      rewardSilverCents: cfg.rewardSilverCents,
      rewardGoldCents: cfg.rewardGoldCents,
      rewardDiamondCents: cfg.rewardDiamondCents,
      tierSilverMinCommissions: cfg.tierSilverMinCommissions,
      tierGoldMinCommissions: cfg.tierGoldMinCommissions,
      tierDiamondMinCommissions: cfg.tierDiamondMinCommissions,
    },
    paidReferralsCount: paidCount,
    signupReferralsCount: signups.length,
    currentTier,
    currentTierLabel: tierLabelPt(currentTier),
    nextRewardCents: next,
    balances,
    pendingSignupReferrals,
    minWithdrawalCents: minAffiliateWithdrawalCents(),
    commissionActivity: activity,
  };
}
