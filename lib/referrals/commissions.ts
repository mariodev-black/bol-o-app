import { getPool } from "@/lib/db";
import { applyWalletMovementTx } from "@/lib/wallet/ledger";
import {
  getReferralProgramConfig,
  rewardCentsForTier,
  tierForCommissionIndex,
  type ReferralTierId,
} from "@/lib/referrals/config";

export type CommissionModel = "standard" | "influencer";
export type CommissionTier = ReferralTierId | "influencer";

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

  const refRow = await pool.query<{
    referred_by_user_id: string | null;
    affiliate_mode: string | null;
    influencer_cpa_bps: number | null;
    amount_cents: number | null;
  }>(
    `SELECT
       buyer.referred_by_user_id,
       COALESCE(referrer.affiliate_mode, 'standard') AS affiliate_mode,
       COALESCE(referrer.influencer_cpa_bps, 0) AS influencer_cpa_bps,
       tx.amount_cents
     FROM users buyer
     JOIN transactions tx ON tx.id::text = $2::text
     LEFT JOIN users referrer ON referrer.id::text = buyer.referred_by_user_id::text
     WHERE buyer.id::text = $1::text
     LIMIT 1`,
    [input.buyerUserId, input.transactionId]
  );
  const referral = refRow.rows[0];
  const referrerId = referral?.referred_by_user_id;
  if (!referrerId || referrerId === input.buyerUserId) return;
  const commissionModel: CommissionModel = referral.affiliate_mode === "influencer" ? "influencer" : "standard";
  const baseAmountCents = Number(referral.amount_cents ?? 0);

  if (commissionModel === "standard") {
    const alreadyForFriend = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM referral_commissions
         WHERE referrer_user_id = $1::uuid AND referred_user_id = $2::uuid
       ) AS exists`,
      [referrerId, input.buyerUserId]
    );
    if (alreadyForFriend.rows[0]?.exists) return;
  }

  const { rows: countRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM referral_commissions WHERE referrer_user_id = $1::uuid`,
    [referrerId]
  );
  const prev = Number.parseInt(countRows[0]?.c ?? "0", 10) || 0;
  const commissionIndex = prev + 1;
  const tier: CommissionTier = commissionModel === "influencer"
    ? "influencer"
    : tierForCommissionIndex(config, commissionIndex);
  const cpaBps = commissionModel === "influencer"
    ? Math.max(0, Math.min(10000, Number(referral.influencer_cpa_bps ?? 0)))
    : null;
  const amountCents = commissionModel === "influencer"
    ? Math.round((baseAmountCents * (cpaBps ?? 0)) / 10000)
    : rewardCentsForTier(config, tier as ReferralTierId);
  if (amountCents <= 0) return;

  // Insere a comissão e credita o saldo de afiliado (via ledger) na mesma transação —
  // o ledger é a única fonte que muda `affiliate_balance_cents`, evitando crédito duplicado.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO referral_commissions (
         referrer_user_id, referred_user_id, transaction_id, amount_cents, tier, commission_index,
         commission_model, cpa_bps, base_amount_cents
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (transaction_id) DO NOTHING
       RETURNING id`,
      [
        referrerId,
        input.buyerUserId,
        input.transactionId,
        amountCents,
        tier,
        commissionIndex,
        commissionModel,
        cpaBps,
        commissionModel === "influencer" ? baseAmountCents : null,
      ]
    );
    if (rows[0]) {
      await applyWalletMovementTx(client, {
        userId: referrerId,
        amountCents,
        type: "commission",
        idempotencyKey: `commission:${input.transactionId}`,
        transactionId: input.transactionId,
        account: "affiliate",
        metadata: { tier, commissionModel, buyerUserId: input.buyerUserId },
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type AffiliateBalances = {
  totalEarnedCents: number;
  /** Saques pendentes debitados do saldo de afiliado. */
  pendingWithdrawalCents: number;
  /** Saques já pagos/aprovados (origem afiliado). */
  completedWithdrawalCents: number;
  /** Saldo atual em `affiliate_balance_cents` (já desconta pendentes). */
  availableCents: number;
  /** Saldo principal (`balance_cents`), ex.: prêmios do bolão. */
  walletBalanceCents: number;
  pendingWalletWithdrawalCents: number;
  completedWalletWithdrawalCents: number;
  /** Saldo TOTAL disponível para saque (afiliado + carteira) — o que o usuário vê. */
  combinedAvailableCents: number;
  /** Saques pendentes, qualquer origem. */
  combinedPendingCents: number;
  /** Saques já pagos, qualquer origem. */
  completedCombinedCents: number;
};

export async function getAffiliateBalances(userId: string): Promise<AffiliateBalances> {
  const pool = getPool();
  // "combined" é o padrão desde que o saldo virou único (afiliado + carteira num saque só);
  // 'affiliate'/'wallet' seguem existindo só em solicitações antigas.
  const affiliatePendingFilter = `user_id = $1::uuid AND status IN ('pending', 'processing') AND COALESCE(balance_source, 'affiliate') = 'affiliate'`;
  const affiliateDoneFilter = `user_id = $1::uuid AND status IN ('approved', 'paid') AND COALESCE(balance_source, 'affiliate') = 'affiliate'`;
  const walletPendingFilter = `user_id = $1::uuid AND status IN ('pending', 'processing') AND balance_source = 'wallet'`;
  const walletDoneFilter = `user_id = $1::uuid AND status IN ('approved', 'paid') AND balance_source = 'wallet'`;
  const combinedPendingFilter = `user_id = $1::uuid AND status IN ('pending', 'processing') AND balance_source = 'combined'`;
  const combinedDoneFilter = `user_id = $1::uuid AND status IN ('approved', 'paid') AND balance_source = 'combined'`;

  const [earned, pending, done, available, walletRow, pendingWallet, doneWallet, pendingCombined, doneCombined] = await Promise.all([
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM referral_commissions WHERE referrer_user_id = $1::uuid`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM affiliate_withdrawal_requests
       WHERE ${affiliatePendingFilter}`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM affiliate_withdrawal_requests
       WHERE ${affiliateDoneFilter}`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(affiliate_balance_cents, 0)::text AS s FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(balance_cents, 0)::text AS s FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM affiliate_withdrawal_requests WHERE ${walletPendingFilter}`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM affiliate_withdrawal_requests WHERE ${walletDoneFilter}`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM affiliate_withdrawal_requests WHERE ${combinedPendingFilter}`,
      [userId]
    ),
    pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM affiliate_withdrawal_requests WHERE ${combinedDoneFilter}`,
      [userId]
    ),
  ]);
  const totalEarnedCents = Number.parseInt(earned.rows[0]?.s ?? "0", 10) || 0;
  const pendingWithdrawalCents = Number.parseInt(pending.rows[0]?.s ?? "0", 10) || 0;
  const completedWithdrawalCents = Number.parseInt(done.rows[0]?.s ?? "0", 10) || 0;
  const availableCents = Number.parseInt(available.rows[0]?.s ?? "0", 10) || 0;
  const walletBalanceCents = Number.parseInt(walletRow.rows[0]?.s ?? "0", 10) || 0;
  const pendingWalletWithdrawalCents = Number.parseInt(pendingWallet.rows[0]?.s ?? "0", 10) || 0;
  const completedWalletWithdrawalCents = Number.parseInt(doneWallet.rows[0]?.s ?? "0", 10) || 0;
  const pendingCombinedCents = Number.parseInt(pendingCombined.rows[0]?.s ?? "0", 10) || 0;
  const completedCombinedCents = Number.parseInt(doneCombined.rows[0]?.s ?? "0", 10) || 0;
  return {
    totalEarnedCents,
    pendingWithdrawalCents,
    completedWithdrawalCents,
    availableCents,
    walletBalanceCents,
    pendingWalletWithdrawalCents,
    completedWalletWithdrawalCents,
    combinedAvailableCents: availableCents + walletBalanceCents,
    combinedPendingCents: pendingWithdrawalCents + pendingWalletWithdrawalCents + pendingCombinedCents,
    completedCombinedCents: completedWithdrawalCents + completedWalletWithdrawalCents + completedCombinedCents,
  };
}

export type CommissionActivityRow = {
  id: string;
  referredUserId: string;
  referredName: string | null;
  amountCents: number;
  tier: CommissionTier;
  commissionIndex: number;
  commissionModel: CommissionModel;
  cpaBps: number | null;
  baseAmountCents: number | null;
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
    tier: CommissionTier;
    commission_index: number;
    commission_model: CommissionModel;
    cpa_bps: number | null;
    base_amount_cents: number | null;
    created_at: Date;
  }>(
    `SELECT
       c.id,
       c.referred_user_id,
       u.name AS referred_name,
       c.amount_cents,
       c.tier,
       c.commission_index,
       COALESCE(c.commission_model, 'standard') AS commission_model,
       c.cpa_bps,
       c.base_amount_cents,
       c.created_at
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
    commissionModel: r.commission_model,
    cpaBps: r.cpa_bps,
    baseAmountCents: r.base_amount_cents,
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
