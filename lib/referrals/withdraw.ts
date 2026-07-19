import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import { applyCombinedDebitTx } from "@/lib/wallet/ledger";
import { getAffiliateBalances, type AffiliateBalances } from "@/lib/referrals/commissions";
import {
  assertValidPixWithdrawal,
  assertValidWithdrawalUserId,
  assertWithdrawalAmountBounds,
} from "@/lib/referrals/withdrawGuards";
import { ensureWithdrawalBalanceSourceConstraint } from "@/lib/referrals/withdrawSchema";

export type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function minAffiliateWithdrawalCents(): number {
  return intEnv("AFFILIATE_MIN_WITHDRAWAL_CENTS", 2000);
}

export { maxWithdrawalCentsPerRequest } from "@/lib/referrals/withdrawGuards";

/**
 * Solicita saque: debita o saldo TOTAL na hora (afiliado primeiro, depois carteira).
 * O usuário vê 1 saldo só; o banco mantém as 2 colunas e o ledger audita cada uma.
 * - Aprovado (paid): saldo permanece debitado — PIX enviado.
 * - Recusado: admin devolve o valor exato a cada conta de origem.
 */
export async function createAffiliateWithdrawalRequest(input: {
  userId: string;
  amountCents: number;
  pixKeyType: "cpf" | "email" | "phone" | "random";
  pixKey: string;
}): Promise<{ id: string; balances: AffiliateBalances }> {
  const min = minAffiliateWithdrawalCents();

  assertValidWithdrawalUserId(input.userId);
  assertWithdrawalAmountBounds(input.amountCents, min);
  const pixNormalized = assertValidPixWithdrawal(input.pixKeyType, input.pixKey);

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Fora da TX: ALTER CONSTRAINT não pode rolar back com o INSERT.
    await ensureWithdrawalBalanceSourceConstraint(client);

    await client.query("BEGIN");

    // Id gerado antes do débito: serve de chave de idempotência no ledger.
    const requestId = randomUUID();

    // Debita o saldo total (afiliado primeiro) — lança WalletInsufficientFundsError se faltar.
    await applyCombinedDebitTx(client, {
      userId: input.userId,
      amountCents: input.amountCents,
      type: "withdrawal",
      idempotencyKeyBase: `withdrawal:${requestId}`,
      metadata: { source: "withdrawal_request", withdrawalId: requestId },
    });

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO affiliate_withdrawal_requests (id, user_id, amount_cents, pix_key_type, pix_key, status, balance_source)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending', 'combined')
       RETURNING id`,
      [requestId, input.userId.trim(), input.amountCents, input.pixKeyType, pixNormalized]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Falha ao registrar solicitacao");
    await client.query("COMMIT");
    const balances = await getAffiliateBalances(input.userId.trim());
    return { id, balances };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
