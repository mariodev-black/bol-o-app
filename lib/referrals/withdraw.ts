import { getPool } from "@/lib/db";
import { getAffiliateBalances, type AffiliateBalances } from "@/lib/referrals/commissions";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import {
  assertBalanceCoversWithdrawal,
  assertValidPixWithdrawal,
  assertValidWithdrawalUserId,
  assertWithdrawalAmountBounds,
} from "@/lib/referrals/withdrawGuards";

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
 * Solicita saque: debita o saldo na hora (wallet ou afiliado).
 * - Aprovado (paid): saldo permanece debitado — PIX enviado.
 * - Recusado: admin devolve o valor ao mesmo saldo de origem.
 */
export async function createAffiliateWithdrawalRequest(input: {
  userId: string;
  amountCents: number;
  pixKeyType: "cpf" | "email" | "phone" | "random";
  pixKey: string;
  balanceSource?: WithdrawalBalanceSource;
}): Promise<{ id: string; balances: AffiliateBalances }> {
  const min = minAffiliateWithdrawalCents();
  const source: WithdrawalBalanceSource = input.balanceSource ?? "affiliate";

  assertValidWithdrawalUserId(input.userId);
  assertWithdrawalAmountBounds(input.amountCents, min);
  const pixNormalized = assertValidPixWithdrawal(input.pixKeyType, input.pixKey);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: locked } = await client.query<{
      id: string;
      balance_cents: number;
      affiliate_balance_cents: number;
    }>(
      `SELECT id, balance_cents, affiliate_balance_cents
       FROM users
       WHERE id = $1::uuid
       FOR UPDATE`,
      [input.userId.trim()]
    );
    const userRow = locked[0];
    if (!userRow) {
      throw new Error("Usuario nao encontrado");
    }

    assertBalanceCoversWithdrawal(
      source,
      userRow.balance_cents,
      userRow.affiliate_balance_cents,
      input.amountCents
    );

    const debit =
      source === "wallet"
        ? await client.query<{ id: string; balance_cents: number }>(
            `UPDATE users
             SET balance_cents = balance_cents - $2,
                 updated_at = now()
             WHERE id = $1::uuid
               AND balance_cents >= $2
             RETURNING id, balance_cents`,
            [userRow.id, input.amountCents]
          )
        : await client.query<{ id: string; affiliate_balance_cents: number }>(
            `UPDATE users
             SET affiliate_balance_cents = affiliate_balance_cents - $2,
                 updated_at = now()
             WHERE id = $1::uuid
               AND affiliate_balance_cents >= $2
             RETURNING id, affiliate_balance_cents`,
            [userRow.id, input.amountCents]
          );
    const debited = debit.rows[0];
    if (!debited) {
      throw new Error("Saldo insuficiente ou foi alterado. Tente novamente.");
    }

    if (source === "wallet") {
      const b = (debited as { balance_cents: number }).balance_cents;
      if (b < 0) throw new Error("Estado de saldo invalido apos debito");
    } else {
      const a = (debited as { affiliate_balance_cents: number }).affiliate_balance_cents;
      if (a < 0) throw new Error("Estado de saldo invalido apos debito");
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO affiliate_withdrawal_requests (user_id, amount_cents, pix_key_type, pix_key, status, balance_source)
       VALUES ($1::uuid, $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userRow.id, input.amountCents, input.pixKeyType, pixNormalized, source]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Falha ao registrar solicitacao");
    await client.query("COMMIT");
    const balances = await getAffiliateBalances(userRow.id);
    return { id, balances };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
