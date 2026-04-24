import { getPool } from "@/lib/db";
import {
  getReferralProgramConfig,
  rewardCentsForTier,
  tierForCommissionIndex,
  type ReferralTierId,
} from "@/lib/referrals/config";

/**
 * Quando um pagamento de ticket é confirmado, credita o indicador (se houver).
 * Idempotente por `transaction_id`.
 */
export async function recordReferralCommissionIfApplicable(input: {
  buyerUserId: string;
  transactionId: string;
}): Promise<void> {
  const pool = getPool();
  const config = getReferralProgramConfig();

  const dup = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM referral_commissions WHERE transaction_id = $1::uuid) AS exists`,
    [input.transactionId]
  );
  if (dup.rows[0]?.exists) return;

  const refRow = await pool.query<{ referred_by_user_id: string | null }>(
    `SELECT referred_by_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
    [input.buyerUserId]
  );
  const referrerId = refRow.rows[0]?.referred_by_user_id;
  if (!referrerId || referrerId === input.buyerUserId) return;

  const alreadyForFriend = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM referral_commissions
       WHERE referrer_user_id = $1::uuid AND referred_user_id = $2::uuid
     ) AS exists`,
    [referrerId, input.buyerUserId]
  );
  if (alreadyForFriend.rows[0]?.exists) return;

  const { rows: countRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM referral_commissions WHERE referrer_user_id = $1::uuid`,
    [referrerId]
  );
  const prev = Number.parseInt(countRows[0]?.c ?? "0", 10) || 0;
  const commissionIndex = prev + 1;
  const tier: ReferralTierId = tierForCommissionIndex(config, commissionIndex);
  const amountCents = rewardCentsForTier(config, tier);

  await pool.query(
    `INSERT INTO referral_commissions (
       referrer_user_id, referred_user_id, transaction_id, amount_cents, tier, commission_index
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [referrerId, input.buyerUserId, input.transactionId, amountCents, tier, commissionIndex]
  );
}

export type AffiliateBalances = {
  totalEarnedCents: number;
  pendingWithdrawalCents: number;
  completedWithdrawalCents: number;
  availableCents: number;
};

export async function getAffiliateBalances(userId: string): Promise<AffiliateBalances> {
  const pool = getPool();
  const [earned, pending, done] = await Promise.all([
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM referral_commissions WHERE referrer_user_id = $1::uuid`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM affiliate_withdrawal_requests
       WHERE user_id = $1::uuid AND status = 'pending'`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM affiliate_withdrawal_requests
       WHERE user_id = $1::uuid AND status IN ('approved', 'paid')`,
      [userId]
    ),
  ]);
  const totalEarnedCents = Number.parseInt(earned.rows[0]?.s ?? "0", 10) || 0;
  const pendingWithdrawalCents = Number.parseInt(pending.rows[0]?.s ?? "0", 10) || 0;
  const completedWithdrawalCents = Number.parseInt(done.rows[0]?.s ?? "0", 10) || 0;
  const availableCents = Math.max(0, totalEarnedCents - pendingWithdrawalCents - completedWithdrawalCents);
  return { totalEarnedCents, pendingWithdrawalCents, completedWithdrawalCents, availableCents };
}

export type CommissionActivityRow = {
  id: string;
  referredUserId: string;
  referredName: string | null;
  amountCents: number;
  tier: ReferralTierId;
  commissionIndex: number;
  createdAt: string;
};

export async function listCommissionActivityForReferrer(
  referrerUserId: string,
  limit: number
): Promise<CommissionActivityRow[]> {
  const pool = getPool();
  const lim = Math.min(100, Math.max(1, limit));
  const { rows } = await pool.query<{
    id: string;
    referred_user_id: string;
    referred_name: string | null;
    amount_cents: number;
    tier: ReferralTierId;
    commission_index: number;
    created_at: Date;
  }>(
    `SELECT c.id, c.referred_user_id, u.name AS referred_name, c.amount_cents, c.tier, c.commission_index, c.created_at
     FROM referral_commissions c
     JOIN users u ON u.id = c.referred_user_id
     WHERE c.referrer_user_id = $1::uuid
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [referrerUserId, lim]
  );
  return rows.map((r) => ({
    id: r.id,
    referredUserId: r.referred_user_id,
    referredName: r.referred_name,
    amountCents: r.amount_cents,
    tier: r.tier,
    commissionIndex: r.commission_index,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function countPaidReferralsForReferrer(referrerUserId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM referral_commissions WHERE referrer_user_id = $1::uuid`,
    [referrerUserId]
  );
  return Number.parseInt(rows[0]?.c ?? "0", 10) || 0;
}
