import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import {
  type CartwaveCashoutEventData,
  type CartwaveCashoutEventType,
  isCartwaveCashoutEventType,
  parseWithdrawalIdFromCartwaveTag,
  type CartwaveWebhookPayload,
} from "@/lib/payments/cartwave/webhook-types";
import { creditWithdrawalBalance } from "@/lib/referrals/withdrawRefund";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

export type CartwaveWebhookHandleResult = {
  ok: boolean;
  eventType: string;
  action: "ignored" | "updated" | "refunded" | "duplicate";
  withdrawalId: string | null;
  reason?: string;
};

async function ensureWebhookSchema(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE affiliate_withdrawal_requests
      ADD COLUMN IF NOT EXISTS cartwave_end_to_end text,
      ADD COLUMN IF NOT EXISTS cartwave_webhook_last jsonb
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS cartwave_webhook_events (
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

function buildDedupeKey(type: string, data: CartwaveCashoutEventData): string {
  const tx = data.transaction_id ?? "none";
  const status = data.status ?? "";
  const e2e = data.end_to_end ?? data.origin_end_to_end ?? "";
  return `${type}:${tx}:${status}:${e2e}`;
}

async function findWithdrawalRow(
  client: PoolClient,
  data: CartwaveCashoutEventData,
): Promise<{
  id: string;
  user_id: string;
  amount_cents: number;
  balance_source: string | null;
  status: string;
} | null> {
  const tagId = parseWithdrawalIdFromCartwaveTag(data.tag);
  if (tagId) {
    const byTag = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status
       FROM affiliate_withdrawal_requests
       WHERE id = $1::uuid
       LIMIT 1`,
      [tagId],
    );
    if (byTag.rows[0]) return byTag.rows[0];
  }

  if (typeof data.transaction_id === "number") {
    const byTx = await client.query<{
      id: string;
      user_id: string;
      amount_cents: number;
      balance_source: string | null;
      status: string;
    }>(
      `SELECT id, user_id, amount_cents, balance_source, status
       FROM affiliate_withdrawal_requests
       WHERE cartwave_transaction_id = $1
       LIMIT 1`,
      [data.transaction_id],
    );
    if (byTx.rows[0]) return byTx.rows[0];
  }

  return null;
}

async function refundWithdrawalIfNeeded(
  client: PoolClient,
  row: {
    id: string;
    user_id: string;
    amount_cents: number;
    balance_source: string | null;
    status: string;
  },
  note: string,
  nextStatus: "failed" | "refunded",
): Promise<boolean> {
  if (row.status === "rejected" || row.status === "failed" || row.status === "refunded") {
    return false;
  }

  await client.query(`SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`, [row.user_id]);

  const src: WithdrawalBalanceSource = row.balance_source === "wallet" ? "wallet" : "affiliate";
  await creditWithdrawalBalance(client, row.user_id, src, row.amount_cents);

  await client.query(
    `UPDATE affiliate_withdrawal_requests
     SET status = $2,
         rejected_at = COALESCE(rejected_at, now()),
         admin_note = COALESCE($3, admin_note),
         cartwave_status = $4
     WHERE id = $1::uuid`,
    [row.id, nextStatus, note, nextStatus.toUpperCase()],
  );
  return true;
}

async function applyCashoutEvent(
  client: PoolClient,
  eventType: CartwaveCashoutEventType,
  data: CartwaveCashoutEventData,
  fullPayload: CartwaveWebhookPayload,
): Promise<CartwaveWebhookHandleResult> {
  const row = await findWithdrawalRow(client, data);
  if (!row) {
    return {
      ok: true,
      eventType,
      action: "ignored",
      withdrawalId: null,
      reason: "Saque nao encontrado para tag/transaction_id",
    };
  }

  const webhookMeta = {
    type: eventType,
    receivedAt: new Date().toISOString(),
    data,
  };

  const baseUpdate = async (extra: {
    status?: string;
    cartwaveStatus?: string;
    endToEnd?: string | null;
    setProcessedAt?: boolean;
  }) => {
    await client.query(
      `UPDATE affiliate_withdrawal_requests
       SET status = COALESCE($2, status),
           cartwave_transaction_id = COALESCE($3, cartwave_transaction_id),
           cartwave_status = COALESCE($4, cartwave_status),
           cartwave_end_to_end = COALESCE($5, cartwave_end_to_end),
           cartwave_response = COALESCE(cartwave_response, '{}'::jsonb) || $6::jsonb,
           cartwave_webhook_last = $7::jsonb,
           processed_at = CASE WHEN $8 THEN COALESCE(processed_at, now()) ELSE processed_at END
       WHERE id = $1::uuid`,
      [
        row.id,
        extra.status ?? null,
        typeof data.transaction_id === "number" ? data.transaction_id : null,
        extra.cartwaveStatus ?? data.status ?? null,
        extra.endToEnd ?? null,
        JSON.stringify({ lastWebhook: fullPayload }),
        JSON.stringify(webhookMeta),
        extra.setProcessedAt ?? false,
      ],
    );
  };

  switch (eventType) {
    case "PIX_CASHOUT_CREATED":
      await baseUpdate({
        status: row.status === "pending" ? "processing" : row.status,
        cartwaveStatus: data.status ?? "NEW",
      });
      return { ok: true, eventType, action: "updated", withdrawalId: row.id };

    case "PIX_CASHOUT_SUCCESS":
      await baseUpdate({
        status: "paid",
        cartwaveStatus: data.status ?? "SUCCESS",
        endToEnd: data.end_to_end ?? null,
        setProcessedAt: true,
      });
      return { ok: true, eventType, action: "updated", withdrawalId: row.id };

    case "PIX_CASHOUT_ERROR": {
      const note = data.error ?? "Erro no PIX (Cartwave)";
      const refunded = await refundWithdrawalIfNeeded(client, row, note, "failed");
      await baseUpdate({
        status: refunded ? "failed" : row.status,
        cartwaveStatus: data.status ?? "ERROR",
        endToEnd: data.end_to_end ?? null,
      });
      return {
        ok: true,
        eventType,
        action: refunded ? "refunded" : "updated",
        withdrawalId: row.id,
        reason: note,
      };
    }

    case "PIX_CASHOUT_CANCELED": {
      const note = data.cancel_description ?? "PIX cancelado (Cartwave)";
      const refunded = await refundWithdrawalIfNeeded(client, row, note, "failed");
      await baseUpdate({
        status: refunded ? "failed" : row.status,
        cartwaveStatus: data.status ?? "CANCELLED",
        endToEnd: data.end_to_end ?? null,
      });
      return {
        ok: true,
        eventType,
        action: refunded ? "refunded" : "updated",
        withdrawalId: row.id,
        reason: note,
      };
    }

    case "PIX_CASHOUT_REFUND": {
      const note = "PIX devolvido pelo banco destinatario (Cartwave)";
      const refunded = await refundWithdrawalIfNeeded(client, row, note, "refunded");
      await baseUpdate({
        status: refunded ? "refunded" : row.status,
        cartwaveStatus: data.status ?? "REFUNDED",
        endToEnd: data.end_to_end ?? null,
      });
      return {
        ok: true,
        eventType,
        action: refunded ? "refunded" : "updated",
        withdrawalId: row.id,
        reason: note,
      };
    }

    default:
      return {
        ok: true,
        eventType,
        action: "ignored",
        withdrawalId: row.id,
        reason: "Tipo nao tratado",
      };
  }
}

export async function handleCartwaveWebhookPayload(
  payload: CartwaveWebhookPayload,
): Promise<CartwaveWebhookHandleResult> {
  const eventType = typeof payload.type === "string" ? payload.type.trim() : "";
  const data = (payload.data ?? {}) as CartwaveCashoutEventData;

  if (!eventType) {
    return { ok: false, eventType: "", action: "ignored", withdrawalId: null, reason: "type ausente" };
  }

  if (!isCartwaveCashoutEventType(eventType)) {
    return {
      ok: true,
      eventType,
      action: "ignored",
      withdrawalId: null,
      reason: "Evento fora do escopo cash-out",
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureWebhookSchema(client);
    await client.query("BEGIN");

    const dedupeKey = buildDedupeKey(eventType, data);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO cartwave_webhook_events (dedupe_key, event_type, payload)
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
        withdrawalId: parseWithdrawalIdFromCartwaveTag(data.tag),
        reason: "Evento ja processado",
      };
    }

    const result = await applyCashoutEvent(client, eventType, data, payload);

    await client.query(
      `UPDATE cartwave_webhook_events
       SET withdrawal_id = $2::uuid,
           result = $3::jsonb
       WHERE dedupe_key = $1`,
      [
        dedupeKey,
        result.withdrawalId,
        JSON.stringify(result),
      ],
    );

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
