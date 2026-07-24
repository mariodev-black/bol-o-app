import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { fyhubIdempotencyKeyFromUuid } from "@/lib/payments/fyhub/config";
import { creditWithdrawalBalance } from "@/lib/referrals/withdrawRefund";
import { notifyWithdrawalPaidById } from "@/lib/referrals/withdraw-notify";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { ensureWithdrawalStatusConstraint } from "@/lib/referrals/withdrawSchema";
import {
  isTerminalWithdrawalStatus,
  nextCartwaveStatus,
  nextWithdrawalStatus,
  type WithdrawalStatus,
} from "@/lib/referrals/withdrawStatus";

export type FyhubWebhookPayload = {
  type?: string;
  data?: {
    id?: number | string;
    endToEndId?: string;
    status?: string;
    message?: string;
    pixKey?: string;
    idempotencyKey?: string;
    createdAt?: string;
    eventDate?: string;
    errorCode?: string;
    payment?: { currency?: string; amount?: number };
    remittanceInformation?: string;
    [k: string]: unknown;
  };
};

export type FyhubWebhookHandleResult = {
  ok: boolean;
  eventType: string;
  action: "ignored" | "updated" | "refunded" | "duplicate";
  withdrawalId: string | null;
  reason?: string;
};

function normalizeFyhubStatus(raw: string | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/,/g, "");
}

function mapFyhubToWithdrawalStatus(status: string): WithdrawalStatus | null {
  const s = normalizeFyhubStatus(status);
  if (s === "LIQUIDATED" || s === "COMPLETED" || s === "SUCCESS") return "paid";
  if (s === "PROCESSING" || s === "PENDING" || s === "QUEUED") return "processing";
  if (
    s === "CANCELED" ||
    s === "CANCELLED" ||
    s === "FAILED" ||
    s === "ERROR" ||
    s === "REJECTED"
  ) {
    return "failed";
  }
  if (s === "REFUNDED" || s === "PARTIALLY_REFUNDED") return "refunded";
  return null;
}

function balanceSourceOf(raw: string | null): WithdrawalBalanceSource {
  return raw === "wallet" ? "wallet" : raw === "combined" ? "combined" : "affiliate";
}

async function ensureWebhookSchema(client: PoolClient): Promise<void> {
  await ensureWithdrawalStatusConstraint(client);
  await client.query(`
    ALTER TABLE affiliate_withdrawal_requests
      ADD COLUMN IF NOT EXISTS cartwave_transaction_id bigint,
      ADD COLUMN IF NOT EXISTS cartwave_status text,
      ADD COLUMN IF NOT EXISTS cartwave_response jsonb,
      ADD COLUMN IF NOT EXISTS cartwave_end_to_end text,
      ADD COLUMN IF NOT EXISTS cartwave_webhook_last jsonb
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS fyhub_webhook_events (
      id bigserial PRIMARY KEY,
      dedupe_key text NOT NULL UNIQUE,
      event_type text NOT NULL,
      withdrawal_id uuid REFERENCES affiliate_withdrawal_requests(id) ON DELETE SET NULL,
      payload jsonb NOT NULL,
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function buildDedupeKey(type: string, data: NonNullable<FyhubWebhookPayload["data"]>): string {
  const id = data.id ?? "none";
  const status = normalizeFyhubStatus(data.status);
  const e2e = data.endToEndId ?? "";
  const idem = data.idempotencyKey ?? "";
  return `${type}:${id}:${status}:${e2e}:${idem}`;
}

function uuidFromIdempotencyKey(key: string | undefined): string | null {
  const compact = String(key ?? "").replace(/-/g, "").trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function parseWithdrawalIdFromDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/bolao-withdraw:([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

async function findWithdrawalRow(
  client: PoolClient,
  data: NonNullable<FyhubWebhookPayload["data"]>,
): Promise<{
  id: string;
  user_id: string;
  amount_cents: number;
  balance_source: string | null;
  status: string;
  cartwave_status: string | null;
} | null> {
  const fromIdem = uuidFromIdempotencyKey(data.idempotencyKey);
  if (fromIdem) {
    const byIdem = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
      cartwave_status: string | null;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status, cartwave_status
       FROM affiliate_withdrawal_requests WHERE id = $1::uuid LIMIT 1`,
      [fromIdem],
    );
    if (byIdem.rows[0]) return byIdem.rows[0];
  }

  const fromDesc = parseWithdrawalIdFromDescription(data.remittanceInformation);
  if (fromDesc) {
    const byDesc = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
      cartwave_status: string | null;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status, cartwave_status
       FROM affiliate_withdrawal_requests WHERE id = $1::uuid LIMIT 1`,
      [fromDesc],
    );
    if (byDesc.rows[0]) return byDesc.rows[0];
  }

  if (data.endToEndId) {
    const byE2e = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
      cartwave_status: string | null;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status, cartwave_status
       FROM affiliate_withdrawal_requests
       WHERE cartwave_end_to_end = $1
       LIMIT 1`,
      [data.endToEndId],
    );
    if (byE2e.rows[0]) return byE2e.rows[0];
  }

  const numericId =
    typeof data.id === "number"
      ? data.id
      : typeof data.id === "string" && /^\d+$/.test(data.id)
        ? Number(data.id)
        : null;
  if (numericId != null) {
    const byTx = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
      cartwave_status: string | null;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status, cartwave_status
       FROM affiliate_withdrawal_requests
       WHERE cartwave_transaction_id = $1
       LIMIT 1`,
      [numericId],
    );
    if (byTx.rows[0]) return byTx.rows[0];
  }

  return null;
}

export async function handleFyhubCashoutWebhookPayload(
  payload: FyhubWebhookPayload,
): Promise<FyhubWebhookHandleResult> {
  const eventType = String(payload.type ?? "TRANSFER").toUpperCase();
  const data = payload.data ?? {};
  const fyhubStatus = normalizeFyhubStatus(data.status);

  if (eventType !== "TRANSFER" && eventType !== "CASHOUT" && eventType !== "REFUND") {
    return {
      ok: true,
      eventType,
      action: "ignored",
      withdrawalId: null,
      reason: "Tipo de webhook ignorado (nao e TRANSFER/CASHOUT/REFUND)",
    };
  }

  const proposed = mapFyhubToWithdrawalStatus(fyhubStatus);
  if (!proposed) {
    return {
      ok: true,
      eventType,
      action: "ignored",
      withdrawalId: null,
      reason: `Status Fyhub nao mapeado: ${fyhubStatus || "(vazio)"}`,
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureWebhookSchema(client);
    await client.query("BEGIN");

    const dedupeKey = buildDedupeKey(eventType, data);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO fyhub_webhook_events (dedupe_key, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id::text`,
      [dedupeKey, eventType, JSON.stringify(payload)],
    );
    if (!inserted.rows[0]) {
      await client.query("COMMIT");
      return {
        ok: true,
        eventType,
        action: "duplicate",
        withdrawalId: null,
        reason: "Evento ja processado",
      };
    }

    const row = await findWithdrawalRow(client, data);
    if (!row) {
      await client.query(
        `UPDATE fyhub_webhook_events SET result = $2::jsonb WHERE dedupe_key = $1`,
        [dedupeKey, JSON.stringify({ action: "ignored", reason: "withdrawal_not_found" })],
      );
      await client.query("COMMIT");
      return {
        ok: true,
        eventType,
        action: "ignored",
        withdrawalId: null,
        reason: "Saque nao encontrado para este webhook",
      };
    }

    await client.query(
      `UPDATE fyhub_webhook_events SET withdrawal_id = $2::uuid WHERE dedupe_key = $1`,
      [dedupeKey, row.id],
    );

    if (isTerminalWithdrawalStatus(row.status) && row.status === proposed) {
      await client.query("COMMIT");
      return {
        ok: true,
        eventType,
        action: "duplicate",
        withdrawalId: row.id,
        reason: "Saque ja no status terminal",
      };
    }

    const nextStatus = nextWithdrawalStatus(row.status, proposed);
    const nextProviderStatus = nextCartwaveStatus(row.cartwave_status, fyhubStatus || proposed);
    const numericId =
      typeof data.id === "number"
        ? data.id
        : typeof data.id === "string" && /^\d+$/.test(data.id)
          ? Number(data.id)
          : null;

    await client.query(
      `UPDATE affiliate_withdrawal_requests
       SET status = $2,
           cartwave_status = $3,
           cartwave_transaction_id = COALESCE($4, cartwave_transaction_id),
           cartwave_end_to_end = COALESCE($5, cartwave_end_to_end),
           cartwave_webhook_last = $6::jsonb,
           cartwave_response = COALESCE(cartwave_response, '{}'::jsonb) || $6::jsonb,
           processed_at = CASE
             WHEN $2 IN ('paid', 'failed', 'refunded') THEN COALESCE(processed_at, now())
             ELSE processed_at
           END
       WHERE id = $1::uuid`,
      [
        row.id,
        nextStatus,
        nextProviderStatus,
        numericId,
        data.endToEndId ?? null,
        JSON.stringify(payload),
      ],
    );

    let action: FyhubWebhookHandleResult["action"] = "updated";
    if (
      (nextStatus === "failed" || nextStatus === "refunded") &&
      !isTerminalWithdrawalStatus(row.status)
    ) {
      await creditWithdrawalBalance(
        client,
        row.user_id,
        balanceSourceOf(row.balance_source),
        row.amount_cents,
        row.id,
      );
      action = "refunded";
    }

    await client.query(
      `UPDATE fyhub_webhook_events SET result = $2::jsonb WHERE dedupe_key = $1`,
      [dedupeKey, JSON.stringify({ action, status: nextStatus, withdrawalId: row.id })],
    );
    await client.query("COMMIT");

    if (nextStatus === "paid" && row.id) {
      void notifyWithdrawalPaidById(row.id).catch((err) => {
        console.error("[fyhub/webhook] withdraw notify failed", { withdrawalId: row.id, err });
      });
    }

    return { ok: true, eventType, action, withdrawalId: row.id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Utilitário de teste / debug. */
export function fyhubIdempotencyPreview(withdrawalId: string): string {
  return fyhubIdempotencyKeyFromUuid(withdrawalId);
}
