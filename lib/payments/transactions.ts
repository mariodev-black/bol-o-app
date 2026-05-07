import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { createSkalePixTransaction } from "@/lib/payments/skale";
import { getExtraTicketPriceCents, getTicketPriceCents, parseTicketType, type TicketType } from "@/lib/payments/ticket-config";
import { publishTransactionEvent } from "@/lib/payments/transaction-events";
import { recordReferralCommissionIfApplicable } from "@/lib/referrals/commissions";

type BillingUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  cpf: string | null;
};

export type DepositTransactionView = {
  id: string;
  ticketId: string;
  status: string;
  amountCents: number;
  ticketType: TicketType;
  pixQrcode: string | null;
  pixEnd2EndId: string | null;
  providerTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
};

function appUrl(): string {
  return (process.env.APP_URL || "https://bolaodomilhao.com.br").trim().replace(/\/+$/, "");
}

function webhookUrl(): string {
  const explicit = process.env.SKALE_POSTBACK_URL?.trim();
  if (explicit) return explicit;
  return `${appUrl()}/api/webhooks/skale`;
}

export async function findBillingUserById(userId: string): Promise<BillingUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<BillingUser>(
    `SELECT id, name, email, phone, cpf
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

function normalizePhoneForGateway(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function mapRowToView(row: {
  id: string;
  ticket_id: string;
  status: string;
  amount_cents: number;
  ticket_type: TicketType;
  pix_qrcode: string | null;
  pix_end2end_id: string | null;
  provider_transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
}): DepositTransactionView {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    status: row.status,
    amountCents: row.amount_cents,
    ticketType: row.ticket_type,
    pixQrcode: row.pix_qrcode,
    pixEnd2EndId: row.pix_end2end_id,
    providerTransactionId: row.provider_transaction_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createDepositTransaction(input: {
  userId: string;
  ticketType: TicketType;
  quantity: number;
  amountCentsOverride?: number;
}): Promise<DepositTransactionView> {
  const pool = getPool();
  const billingUser = await findBillingUserById(input.userId);
  if (!billingUser) throw new Error("Usuario nao encontrado");
  if (!billingUser.name || billingUser.name.trim().length < 2) {
    throw new Error("Nome do usuario incompleto para pagamento");
  }
  if (!billingUser.cpf || billingUser.cpf.replace(/\D/g, "").length !== 11) {
    throw new Error("CPF do usuario invalido para pagamento");
  }
  if (!billingUser.phone || billingUser.phone.replace(/\D/g, "").length < 10) {
    throw new Error("Telefone do usuario invalido para pagamento");
  }

  const quantity = Math.max(1, Math.min(20, Math.trunc(input.quantity || 1)));
  const unitPriceCents = getTicketPriceCents(input.ticketType);
  const amountCents =
    input.amountCentsOverride && input.amountCentsOverride > 0
      ? Math.trunc(input.amountCentsOverride)
      : unitPriceCents * quantity;
  const externalRef = `ticket_${randomUUID()}`;
  const ticketAmounts = Array.from({ length: quantity }, (_, index) => {
    if (input.ticketType === "general" && quantity === 2 && input.amountCentsOverride) {
      return index === 0 ? getTicketPriceCents("general") : getExtraTicketPriceCents();
    }
    return unitPriceCents;
  });

  const ticketIds: string[] = [];
  for (const ticketAmountCents of ticketAmounts) {
    const ticketInsert = await pool.query<{ id: string }>(
      `INSERT INTO tickets (user_id, ticket_type, unit_price_cents, quantity, total_amount_cents, status, external_ref)
       VALUES ($1, $2, $3, 1, $4, 'pending_payment', $5)
       RETURNING id`,
      [input.userId, input.ticketType, ticketAmountCents, ticketAmountCents, externalRef]
    );
    ticketIds.push(ticketInsert.rows[0]!.id);
  }
  const ticketId = ticketIds[0]!;

  const txInsert = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
      user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request
    ) VALUES ($1, $2, $3, 'skale', 'creating', $4, 'pix', $5, '{}'::jsonb)
    RETURNING id`,
    [input.userId, ticketId, input.ticketType, amountCents, externalRef]
  );
  const transactionId = txInsert.rows[0]!.id;

  try {
    const skale = await createSkalePixTransaction({
      amountCents,
      unitPriceCents,
      quantity,
      ticketType: input.ticketType,
      externalRef,
      postbackUrl: webhookUrl(),
      customer: {
        name: billingUser.name,
        email: billingUser.email,
        phone: normalizePhoneForGateway(billingUser.phone),
        cpf: billingUser.cpf.replace(/\D/g, ""),
      },
    });

    const { rows } = await pool.query<{
      id: string;
      ticket_id: string;
      status: string;
      amount_cents: number;
      ticket_type: TicketType;
      pix_qrcode: string | null;
      pix_end2end_id: string | null;
      provider_transaction_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE transactions
       SET provider_transaction_id = $2,
           status = $3,
           pix_qrcode = $4,
           pix_end2end_id = $5,
           raw_request = $6::jsonb,
           raw_response = $7::jsonb,
           updated_at = now()
       WHERE id = $1
       RETURNING id, ticket_id, status, amount_cents, ticket_type, pix_qrcode, pix_end2end_id, provider_transaction_id, created_at, updated_at`,
      [
        transactionId,
        skale.providerTransactionId,
        skale.status,
        skale.pixQrcode,
        skale.pixEnd2EndId,
        JSON.stringify(skale.rawRequest),
        JSON.stringify(skale.rawResponse),
      ]
    );

    await pool.query(
      `UPDATE tickets
       SET transaction_id = $2, updated_at = now()
       WHERE external_ref = $1`,
      [externalRef, transactionId]
    );

    return mapRowToView(rows[0]!);
  } catch (error) {
    await pool.query(
      `UPDATE transactions
       SET status = 'failed',
           raw_response = jsonb_build_object('error', $2::text),
           updated_at = now()
       WHERE id = $1`,
      [transactionId, error instanceof Error ? error.message : "Erro ao criar transacao"]
    );
    await pool.query(
      `UPDATE tickets SET status = 'failed', updated_at = now() WHERE external_ref = $1`,
      [externalRef]
    );
    throw error;
  }
}

export async function getDepositTransactionById(userId: string, id: string): Promise<DepositTransactionView | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    ticket_id: string;
    status: string;
    amount_cents: number;
    ticket_type: TicketType;
    pix_qrcode: string | null;
    pix_end2end_id: string | null;
    provider_transaction_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, ticket_id, status, amount_cents, ticket_type, pix_qrcode, pix_end2end_id, provider_transaction_id, created_at, updated_at
     FROM transactions
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, userId]
  );
  const row = rows[0];
  return row ? mapRowToView(row) : null;
}

export async function updateTransactionStatusByProviderId(input: {
  providerTransactionId: string;
  status: string;
  pixQrcode?: string | null;
  pixEnd2EndId?: string | null;
  rawWebhook?: unknown;
}): Promise<{ transactionId: string; userId: string; status: string; pixQrcode: string | null; providerTransactionId: string } | null> {
  const pool = getPool();
  const safeStatus = String(input.status || "").trim() || "unknown";

  const updateTx = await pool.query<{ id: string; user_id: string; ticket_id: string; external_ref: string; pix_qrcode: string | null; provider_transaction_id: string }>(
    `UPDATE transactions
     SET status = $2,
         pix_qrcode = COALESCE($3, pix_qrcode),
         pix_end2end_id = COALESCE($4, pix_end2end_id),
         raw_webhook = COALESCE($5::jsonb, raw_webhook),
         updated_at = now()
     WHERE provider_transaction_id = $1 OR id::text = $1
     RETURNING id, user_id, ticket_id, external_ref, pix_qrcode, provider_transaction_id`,
    [
      input.providerTransactionId,
      safeStatus,
      input.pixQrcode ?? null,
      input.pixEnd2EndId ?? null,
      input.rawWebhook ? JSON.stringify(input.rawWebhook) : null,
    ]
  );

  const row = updateTx.rows[0];
  if (!row?.ticket_id) return null;

  const ticketStatus =
    safeStatus === "paid" || safeStatus === "approved"
      ? "paid"
      : safeStatus === "canceled" || safeStatus === "cancelled"
        ? "cancelled"
        : safeStatus === "expired"
          ? "expired"
          : "pending_payment";

  await pool.query(
    `UPDATE tickets
     SET status = $2,
         paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
         updated_at = now()
     WHERE external_ref = $1`,
    [row.external_ref, ticketStatus]
  );

  if (ticketStatus === "paid") {
    try {
      await recordReferralCommissionIfApplicable({
        buyerUserId: row.user_id,
        transactionId: row.id,
      });
    } catch (e) {
      console.error("[referral] commission on paid transaction", e);
    }
  }

  publishTransactionEvent({
    transactionId: row.id,
    status: safeStatus,
    pixQrcode: row.pix_qrcode,
    providerTransactionId: row.provider_transaction_id,
  });
  return {
    transactionId: row.id,
    userId: row.user_id,
    status: safeStatus,
    pixQrcode: row.pix_qrcode,
    providerTransactionId: row.provider_transaction_id,
  };
}

export function parseTicketTypeOrThrow(input: unknown): TicketType {
  const t = parseTicketType(input);
  if (!t) throw new Error("ticketType invalido. Use 'general' ou 'daily'.");
  return t;
}
