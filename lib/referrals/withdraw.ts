import { getPool } from "@/lib/db";
import { getAffiliateBalances } from "@/lib/referrals/commissions";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function minAffiliateWithdrawalCents(): number {
  return intEnv("AFFILIATE_MIN_WITHDRAWAL_CENTS", 2000);
}

export async function createAffiliateWithdrawalRequest(input: {
  userId: string;
  amountCents: number;
  pixKeyType: "cpf" | "email" | "phone" | "random";
  pixKey: string;
}): Promise<{ id: string }> {
  const min = minAffiliateWithdrawalCents();
  if (input.amountCents < min) {
    throw new Error(`Valor minimo para saque: R$ ${(min / 100).toFixed(2).replace(".", ",")}`);
  }
  const { availableCents } = await getAffiliateBalances(input.userId);
  if (input.amountCents > availableCents) {
    throw new Error("Saldo insuficiente para este valor");
  }

  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO affiliate_withdrawal_requests (user_id, amount_cents, pix_key_type, pix_key, status)
     VALUES ($1::uuid, $2, $3, trim($4), 'pending')
     RETURNING id`,
    [input.userId, input.amountCents, input.pixKeyType, input.pixKey]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Falha ao registrar solicitacao");
  return { id };
}
