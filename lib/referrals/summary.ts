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
import { maxWithdrawalCentsPerRequest } from "@/lib/referrals/withdrawGuards";
import { getPool } from "@/lib/db";

export type AffiliateSummaryPayload = {
  affiliateMode: "standard" | "influencer";
  influencerCpaBps: number;
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
    walletBalanceCents: number;
    pendingWalletWithdrawalCents: number;
    completedWalletWithdrawalCents: number;
  };
  /** Cadastros que ainda não geraram comissão (nenhum ticket pago vinculado). */
  pendingSignupReferrals: ReferredUserSummary[];
  minWithdrawalCents: number;
  /** Teto por solicitação (centavos), alinhado ao servidor. */
  maxWithdrawalCents: number;
  commissionActivity: Awaited<ReturnType<typeof listCommissionActivityForReferrer>>;
};

export async function buildAffiliateSummaryForUser(
  referrerUserId: string,
  signups: ReferredUserSummary[]
): Promise<AffiliateSummaryPayload> {
  const cfg = getReferralProgramConfig();
  const pool = getPool();
  const [paidCount, balances, activity, modeResult] = await Promise.all([
    countPaidReferralsForReferrer(referrerUserId),
    getAffiliateBalances(referrerUserId),
    listCommissionActivityForReferrer(referrerUserId, 40),
    pool.query<{ affiliate_mode: string | null; influencer_cpa_bps: number | null }>(
      `SELECT COALESCE(affiliate_mode, 'standard') AS affiliate_mode,
              COALESCE(influencer_cpa_bps, 0) AS influencer_cpa_bps
       FROM users
       WHERE id::text = $1::text
       LIMIT 1`,
      [referrerUserId]
    ),
  ]);
  const modeRow = modeResult.rows[0];
  const affiliateMode = modeRow?.affiliate_mode === "influencer" ? "influencer" : "standard";

  const paidReferredIds = new Set(activity.map((a) => a.referredUserId));
  const pendingSignupReferrals = signups.filter((s) => !paidReferredIds.has(s.id));

  const currentTier = currentTierFromPaidCount(cfg, paidCount);
  const next = nextRewardCents(cfg, paidCount);

  return {
    affiliateMode,
    influencerCpaBps: Number(modeRow?.influencer_cpa_bps ?? 0),
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
    maxWithdrawalCents: maxWithdrawalCentsPerRequest(),
    commissionActivity: activity,
  };
}
