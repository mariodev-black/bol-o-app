import { getPool } from "@/lib/db";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { isUuidString } from "@/lib/referrals/withdrawGuards";

export type AdminPendingWithdrawalRow = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  balanceSource: WithdrawalBalanceSource;
  createdAt: string;
};

function assertRequestId(requestId: string): boolean {
  return isUuidString(requestId.trim());
}

export async function listPendingWithdrawalsForAdmin(): Promise<AdminPendingWithdrawalRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
    balance_source: string | null;
    created_at: Date;
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
       w.created_at
     FROM affiliate_withdrawal_requests w
     JOIN users u ON u.id = w.user_id
     WHERE w.status = 'pending'
       AND w.amount_cents > 0
     ORDER BY w.created_at ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    amountCents: r.amount_cents,
    pixKeyType: r.pix_key_type,
    pixKey: r.pix_key,
    balanceSource: r.balance_source === "wallet" ? "wallet" : "affiliate",
    createdAt: r.created_at.toISOString(),
  }));
}

export async function approveWithdrawalRequestById(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!assertRequestId(requestId)) {
    return { ok: false, error: "Identificador de solicitacao invalido" };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ id: string }>(
      `SELECT id
       FROM affiliate_withdrawal_requests
       WHERE id = $1::uuid
         AND status = 'pending'
         AND amount_cents > 0
       FOR UPDATE`,
      [requestId.trim()]
    );
    if (!lock.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }
    const { rowCount } = await client.query(
      `UPDATE affiliate_withdrawal_requests
       SET status = 'approved'
       WHERE id = $1::uuid
         AND status = 'pending'
         AND amount_cents > 0`,
      [requestId.trim()]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK");
    return { ok: false, error: "Erro ao aprovar saque" };
  } finally {
    client.release();
  }
}

export async function rejectWithdrawalRequestById(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!assertRequestId(requestId)) {
    return { ok: false, error: "Identificador de solicitacao invalido" };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
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
      [requestId.trim()]
    );
    const row = pending.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }

    const userLock = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`,
      [row.user_id]
    );
    if (!userLock.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Usuario nao encontrado" };
    }

    const mark = await client.query(
      `UPDATE affiliate_withdrawal_requests
       SET status = 'rejected'
       WHERE id = $1::uuid
         AND status = 'pending'
         AND amount_cents > 0`,
      [row.id]
    );
    if (!mark.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Solicitacao nao encontrada ou ja processada" };
    }

    const src = row.balance_source === "wallet" ? "wallet" : "affiliate";
    const amt = row.amount_cents;
    if (src === "wallet") {
      const u = await client.query<{ balance_cents: number }>(
        `UPDATE users
         SET balance_cents = balance_cents + $2,
             updated_at = now()
         WHERE id = $1::uuid
         RETURNING balance_cents`,
        [row.user_id, amt]
      );
      const br = u.rows[0];
      if (!br || br.balance_cents < 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Estado de saldo invalido apos estorno" };
      }
    } else {
      const u = await client.query<{ affiliate_balance_cents: number }>(
        `UPDATE users
         SET affiliate_balance_cents = affiliate_balance_cents + $2,
             updated_at = now()
         WHERE id = $1::uuid
         RETURNING affiliate_balance_cents`,
        [row.user_id, amt]
      );
      const ar = u.rows[0];
      if (!ar || ar.affiliate_balance_cents < 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Estado de saldo invalido apos estorno" };
      }
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
