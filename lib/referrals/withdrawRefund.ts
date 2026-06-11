import type { PoolClient } from "pg";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

export async function creditWithdrawalBalance(
  client: PoolClient,
  userId: string,
  balanceSource: WithdrawalBalanceSource,
  amountCents: number,
): Promise<void> {
  if (balanceSource === "wallet") {
    const u = await client.query<{ balance_cents: number }>(
      `UPDATE users
       SET balance_cents = balance_cents + $2, updated_at = now()
       WHERE id = $1::uuid
       RETURNING balance_cents`,
      [userId, amountCents],
    );
    if (!u.rows[0] || u.rows[0].balance_cents < 0) {
      throw new Error("Estado de saldo invalido apos estorno");
    }
    return;
  }

  const u = await client.query<{ affiliate_balance_cents: number }>(
    `UPDATE users
     SET affiliate_balance_cents = affiliate_balance_cents + $2, updated_at = now()
     WHERE id = $1::uuid
     RETURNING affiliate_balance_cents`,
    [userId, amountCents],
  );
  if (!u.rows[0] || u.rows[0].affiliate_balance_cents < 0) {
    throw new Error("Estado de saldo invalido apos estorno");
  }
}
