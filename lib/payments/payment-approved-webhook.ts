import { getPool } from "@/lib/db";

function serializeJsonValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(serializeJsonValue);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      out[k] = serializeJsonValue(val);
    }
    return out;
  }
  return v;
}

function serializeDbRow(row: Record<string, unknown>): Record<string, unknown> {
  return serializeJsonValue(row) as Record<string, unknown>;
}

export type PaymentApprovedWebhookInput = {
  transactionId: string;
  userId: string;
  /** Último corpo recebido do gateway nesta atualização (se houver). */
  gatewayLatestPayload: unknown | null;
};

/**
 * POST JSON para `PAYMENT_APPROVED_WEBHOOK_URL` na primeira confirmação de pagamento.
 * Falhas são logadas; não propagam erro para o fluxo do gateway.
 */
export async function postPaymentApprovedWebhookIfConfigured(input: PaymentApprovedWebhookInput): Promise<void> {
  const url = process.env.PAYMENT_APPROVED_WEBHOOK_URL?.trim();
  if (!url) return;

  const pool = getPool();
  const [userResult, txResult, ticketResult] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT
         u.id,
         u.email,
         u.name,
         u.phone,
         u.cpf,
         COALESCE(u.role, 'user') AS role,
         u.referral_code,
         u.referred_by_user_id,
         u.google_sub,
         u.email_verified_at,
         u.avatar_url,
         u.avatar_index,
         u.avatar_upload_filename,
         u.created_at,
         COALESCE(u.affiliate_mode, 'standard') AS affiliate_mode,
         COALESCE(u.influencer_cpa_bps, 0) AS influencer_cpa_bps,
         COALESCE(u.balance_cents, 0) AS balance_cents,
         COALESCE(u.affiliate_balance_cents, 0) AS affiliate_balance_cents,
         COALESCE(u.admin_2fa_enabled, false) AS admin_2fa_enabled
       FROM users u
       WHERE u.id = $1::uuid
       LIMIT 1`,
      [input.userId]
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method,
              external_ref, provider_transaction_id, pix_qrcode, pix_end2end_id,
              raw_request, raw_response, created_at, updated_at
       FROM transactions WHERE id = $1::uuid LIMIT 1`,
      [input.transactionId]
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, user_id, ticket_type, extra_championship_id, unit_price_cents, quantity,
              total_amount_cents, is_promo_bonus, status, external_ref, transaction_id,
              created_at, updated_at, paid_at, play_date, daily_status, available_games
       FROM tickets WHERE transaction_id = $1::uuid ORDER BY created_at ASC NULLS LAST, id ASC`,
      [input.transactionId]
    ),
  ]);
  const user = userResult.rows[0] ? serializeDbRow(userResult.rows[0]) : null;
  const transaction = txResult.rows[0] ? serializeDbRow(txResult.rows[0]) : null;
  const tickets = ticketResult.rows.map((r) => serializeDbRow(r));

  const body = {
    event: "payment.approved",
    occurredAt: new Date().toISOString(),
    customer: user,
    transaction,
    tickets,
    gatewayLatestPayload: input.gatewayLatestPayload ?? null,
  };

  const secret = process.env.PAYMENT_APPROVED_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const timeoutMsRaw = process.env.PAYMENT_APPROVED_WEBHOOK_TIMEOUT_MS?.trim();
  const timeoutMs = Math.min(60_000, Math.max(2_000, Number(timeoutMsRaw) || 12_000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[payment-approved-webhook] non-ok response", {
        status: res.status,
        statusText: res.statusText,
        snippet: text.slice(0, 500),
        transactionId: input.transactionId,
      });
    }
  } catch (e) {
    console.error("[payment-approved-webhook] request failed", {
      transactionId: input.transactionId,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearTimeout(timer);
  }
}
