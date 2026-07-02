import type { PoolClient } from "pg";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { applyWalletMovementTx, type WalletAccount } from "@/lib/wallet/ledger";

/**
 * Devolve o valor de um saque ao(s) saldo(s) de origem (recusa do admin ou
 * falha no PIX). `withdrawalId` torna o estorno idempotente: no máximo um
 * crédito por solicitação, mesmo se admin-recusa e webhook de falha
 * dispararem juntos.
 *
 * "combined" (saque unificado, afiliado-primeiro): a decomposição exata de
 * quanto saiu de cada conta já está gravada no ledger (chaves
 * `withdrawal:<id>:affiliate` / `withdrawal:<id>:wallet`) — lemos de lá em
 * vez de adivinhar, e devolvemos o mesmo valor à mesma conta.
 */
export async function creditWithdrawalBalance(
  client: PoolClient,
  userId: string,
  balanceSource: WithdrawalBalanceSource,
  amountCents: number,
  withdrawalId: string,
): Promise<void> {
  if (balanceSource === "combined") {
    const { rows } = await client.query<{ account: string; debited: string }>(
      `SELECT account, (-amount_cents)::text AS debited
         FROM wallet_ledger
        WHERE idempotency_key IN ($1, $2)`,
      [`withdrawal:${withdrawalId}:affiliate`, `withdrawal:${withdrawalId}:wallet`]
    );
    for (const row of rows) {
      const account: WalletAccount = row.account === "affiliate" ? "affiliate" : "wallet";
      const debited = Number(row.debited);
      if (debited <= 0) continue;
      await applyWalletMovementTx(client, {
        userId,
        amountCents: debited,
        type: "refund",
        idempotencyKey: `withdrawal_refund:${withdrawalId}:${account}`,
        metadata: { source: "withdrawal_refund", withdrawalId },
        account,
      });
    }
    return;
  }

  if (balanceSource === "wallet") {
    await applyWalletMovementTx(client, {
      userId,
      amountCents,
      type: "refund",
      idempotencyKey: `withdrawal_refund:${withdrawalId}`,
      metadata: { source: "withdrawal_refund", withdrawalId },
    });
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
