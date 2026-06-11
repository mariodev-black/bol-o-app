import { getPool } from "@/lib/db";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

export type UserWithdrawalHistoryItem = {
  id: string;
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  balanceSource: WithdrawalBalanceSource;
  status: string;
  createdAt: string;
  processedAt: string | null;
  rejectedAt: string | null;
};

export async function listUserWithdrawalHistory(
  userId: string,
  limit = 50,
): Promise<UserWithdrawalHistoryItem[]> {
  const pool = getPool();
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const { rows } = await pool.query<{
    id: string;
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
    balance_source: string | null;
    status: string;
    created_at: Date;
    processed_at: Date | null;
    rejected_at: Date | null;
  }>(
    `SELECT id, amount_cents, pix_key_type, pix_key, balance_source, status, created_at, processed_at, rejected_at
     FROM affiliate_withdrawal_requests
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit],
  );

  return rows.map((r) => ({
    id: r.id,
    amountCents: r.amount_cents,
    pixKeyType: r.pix_key_type,
    pixKey: r.pix_key,
    balanceSource: r.balance_source === "wallet" ? "wallet" : "affiliate",
    status: r.status,
    createdAt: r.created_at.toISOString(),
    processedAt: r.processed_at?.toISOString() ?? null,
    rejectedAt: r.rejected_at?.toISOString() ?? null,
  }));
}
