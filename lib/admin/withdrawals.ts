import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { isCartwaveConfigured } from "@/lib/payments/cartwave/config";
import { createCartwavePixCashoutSelfApprove } from "@/lib/payments/cartwave/cashout";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { creditWithdrawalBalance } from "@/lib/referrals/withdrawRefund";
import { ensureWithdrawalStatusConstraint } from "@/lib/referrals/withdrawSchema";
import { isUuidString } from "@/lib/referrals/withdrawGuards";

export type AdminWithdrawalRow = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  balanceSource: WithdrawalBalanceSource;
  status: string;
  cartwaveTransactionId: number | null;
  cartwaveStatus: string | null;
  createdAt: string;
  processedAt: string | null;
  rejectedAt: string | null;
};

async function ensureWithdrawalSchema(client: PoolClient): Promise<void> {
  await ensureWithdrawalStatusConstraint(client);
  await client.query(`
    ALTER TABLE affiliate_withdrawal_requests
      ADD COLUMN IF NOT EXISTS cartwave_transaction_id bigint,
      ADD COLUMN IF NOT EXISTS cartwave_status text,
      ADD COLUMN IF NOT EXISTS cartwave_response jsonb,
      ADD COLUMN IF NOT EXISTS cartwave_end_to_end text,
      ADD COLUMN IF NOT EXISTS cartwave_webhook_last jsonb,
      ADD COLUMN IF NOT EXISTS processed_at timestamptz,
      ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
      ADD COLUMN IF NOT EXISTS admin_note text
  `);
}

function mapWithdrawalRow(r: {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  amount_cents: number;
  pix_key_type: string;
  pix_key: string;
  balance_source: string | null;
  status: string;
  cartwave_transaction_id: number | null;
  cartwave_status: string | null;
  created_at: Date;
  processed_at: Date | null;
  rejected_at: Date | null;
}): AdminWithdrawalRow {
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    amountCents: r.amount_cents,
    pixKeyType: r.pix_key_type,
    pixKey: r.pix_key,
    balanceSource: r.balance_source === "wallet" ? "wallet" : "affiliate",
    status: r.status,
    cartwaveTransactionId: r.cartwave_transaction_id,
    cartwaveStatus: r.cartwave_status,
    createdAt: r.created_at.toISOString(),
    processedAt: r.processed_at?.toISOString() ?? null,
    rejectedAt: r.rejected_at?.toISOString() ?? null,
  };
}

export async function listPendingWithdrawalsForAdmin(): Promise<AdminWithdrawalRow[]> {
  return listWithdrawalsForAdmin("pending");
}

export async function listWithdrawalsForAdmin(
  status?: "pending" | "processing" | "paid" | "rejected" | "failed" | "refunded" | "all",
): Promise<AdminWithdrawalRow[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureWithdrawalSchema(client);
  } finally {
    client.release();
  }

  const params: unknown[] = [];
  let where = "w.amount_cents > 0";
  if (status && status !== "all") {
    params.push(status);
    where += ` AND w.status = $${params.length}`;
  }

  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
    balance_source: string | null;
    status: string;
    cartwave_transaction_id: number | null;
    cartwave_status: string | null;
    created_at: Date;
    processed_at: Date | null;
    rejected_at: Date | null;
  }>(
    `SELECT
       w.id,
       w.user_id,
       u.email AS user_email,
       u.name AS user_name,
       w.amount_cents,
       w.pix_key_type,
       w.pix_key,
       w.balance_source,
       w.status,
       w.cartwave_transaction_id,
       w.cartwave_status,
       w.created_at,
       w.processed_at,
       w.rejected_at
     FROM affiliate_withdrawal_requests w
     JOIN users u ON u.id = w.user_id
     WHERE ${where}
     ORDER BY w.created_at DESC
     LIMIT 500`,
    params,
  );
  return rows.map(mapWithdrawalRow);
}

/** Aprova saque: envia PIX. Saldo já foi debitado na solicitação — não estorna. */
export async function approveWithdrawalRequestById(
  requestId: string,
): Promise<{ ok: true; cartwaveTransactionId: number | null } | { ok: false; error: string }> {
  const id = requestId.trim();
  if (!isUuidString(id)) {
    return { ok: false, error: "Identificador de solicitacao invalido" };
  }
  if (!isCartwaveConfigured()) {
    return { ok: false, error: "Cartwave nao configurado no servidor (.env)" };
  }

  const pool = getPool();
  const client = await pool.connect();
  let row: {
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
  } | null = null;

  try {
    await ensureWithdrawalSchema(client);
    await client.query("BEGIN");
    const pending = await client.query<{
      amount_cents: number;
      pix_key_type: string;
      pix_key: string;
    }>(
      `SELECT amount_cents, pix_key_type, pix_key
       FROM affiliate_withdrawal_requests
       WHERE id = $1::uuid
         AND status = 'pending'
         AND amount_cents > 0
       FOR UPDATE`,
      [id],
    );
    row = pending.rows[0] ?? null;
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    return { ok: false, error: "Erro ao reservar solicitacao" };
  } finally {
    client.release();
  }

  let cashout;
  try {
    cashout = await createCartwavePixCashoutSelfApprove({
      amountCents: row.amount_cents,
      pixKeyType: row.pix_key_type,
      pixKey: row.pix_key,
      idempotencyKey: id,
      tag: `bolao-withdraw:${id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar PIX via Cartwave";
    return { ok: false, error: msg };
  }

  const client2 = await pool.connect();
  try {
    await ensureWithdrawalSchema(client2);
    await client2.query("BEGIN");
    const { rows: updated } = await client2.query<{ id: string; status: string }>(
      `UPDATE affiliate_withdrawal_requests
       SET status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
           cartwave_transaction_id = COALESCE($2, cartwave_transaction_id),
           cartwave_status = COALESCE($3, cartwave_status),
           cartwave_response = COALESCE(cartwave_response, '{}'::jsonb) || $4::jsonb
       WHERE id = $1::uuid
         AND status IN ('pending', 'processing', 'paid')
       RETURNING id, status`,
      [id, cashout.transactionId, cashout.status, JSON.stringify(cashout.raw)],
    );
    const saved = updated[0];
    if (!saved) {
      const existing = await client2.query<{ status: string; cartwave_transaction_id: number | null }>(
        `SELECT status, cartwave_transaction_id
         FROM affiliate_withdrawal_requests
         WHERE id = $1::uuid`,
        [id],
      );
      const row = existing.rows[0];
      await client2.query("ROLLBACK");
      if (
        row &&
        (row.status === "paid" || row.status === "processing") &&
        row.cartwave_transaction_id === cashout.transactionId
      ) {
        return { ok: true, cartwaveTransactionId: cashout.transactionId };
      }
      return { ok: false, error: "Solicitacao ja processada por outro admin" };
    }
    await client2.query("COMMIT");
    return { ok: true, cartwaveTransactionId: cashout.transactionId };
  } catch {
    await client2.query("ROLLBACK");
    return { ok: false, error: "Erro ao finalizar aprovacao do saque" };
  } finally {
    client2.release();
  }
}

/** Recusa saque: devolve o valor debitado ao saldo de origem do usuário. */
export async function rejectWithdrawalRequestById(
  requestId: string,
  adminNote?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = requestId.trim();
  if (!isUuidString(id)) {
    return { ok: false, error: "Identificador de solicitacao invalido" };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureWithdrawalSchema(client);
    await client.query("BEGIN");

    const pending = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
    }>(
      `SELECT id, user_id, amount_cents, balance_source
       FROM affiliate_withdrawal_requests
       WHERE id = $1::uuid
         AND status = 'pending'
         AND amount_cents > 0
       FOR UPDATE`,
      [id],
    );
    const row = pending.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }

    await client.query(`SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`, [row.user_id]);

    const mark = await client.query(
      `UPDATE affiliate_withdrawal_requests
       SET status = 'rejected',
           rejected_at = now(),
           admin_note = COALESCE($2, admin_note)
       WHERE id = $1::uuid
         AND status = 'pending'`,
      [row.id, adminNote?.trim() || null],
    );
    if (!mark.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }

    const src = row.balance_source === "wallet" ? "wallet" : "affiliate";
    try {
      await creditWithdrawalBalance(client, row.user_id, src, row.amount_cents);
    } catch {
      await client.query("ROLLBACK");
      return { ok: false, error: "Estado de saldo invalido apos estorno" };
    }

    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK");
    return { ok: false, error: "Erro ao recusar saque" };
  } finally {
    client.release();
  }
}
