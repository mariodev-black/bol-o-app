import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import {
  CASH_IN_INITIAL_STATUS,
  PAYMENT_PROVIDER,
  normalizeGatewayStatus,
} from "@/lib/payments/gateway";
import { createSkalePixTransaction } from "@/lib/payments/skalepayments";
import { normalizeDailyByEditionInput } from "@/lib/boloes/daily-editions";
import { isDailyEditionPurchaseOpen } from "@/lib/boloes/daily-editions-server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { fetchMatchesMap } from "@/lib/football-api";
import {
  buildComprarCotasPromoTicketLines,
  buildPurchaseTicketLines,
  parseTicketType,
  type PurchaseExtraInput,
  type TicketType,
} from "@/lib/payments/ticket-config";
import { postPaymentApprovedWebhookIfConfigured } from "@/lib/payments/payment-approved-webhook";
import { publishTransactionEvent } from "@/lib/payments/transaction-events";
import { validateBrasilMarrocosPlacarPromoSubmission } from "@/lib/promotions/brasil-marrocos-placar-promo";
import { invalidatePromoHubCache } from "@/lib/promotions/hub";
import { recordReferralCommissionIfApplicable } from "@/lib/referrals/commissions";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { getTicketShopExtraRoundNumber } from "@/lib/ticket-shop-extra-display";

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

export type CreateDepositTransactionInput =
  | { userId: string; ticketType: "general" | "daily"; quantity: number; dailyEditionNumber?: number }
  | { userId: string; ticketType: "extra"; quantity: number; extraChampionshipId: number }
  | {
      userId: string;
      generalQty: number;
      /** Legado — rejeitado; use `dailyByEdition`. */
      dailyQty?: number;
      /** Quantidade por edição do bolão diário (chave = número da edição 1–11). */
      dailyByEdition?: Record<number, number>;
      /** Preferir: quantidade total de cotas extras (valor e alocação só no servidor). */
      extraQuantity?: number;
      /** Legado: quantidades por campeonato (filtrado pelo servidor). */
      extraByChampionship?: Record<number, number>;
      /** Checkout promocional `/comprar-cotas` — preço fixo por cota, calculado no servidor. */
      checkoutPromo?: "comprar-cotas";
    };

function normalizeExtraByChampionship(map: Record<number, number> | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  if (!map) return out;
  for (const [k, v] of Object.entries(map)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    out[id] = Math.max(0, Math.min(20, Math.trunc(Number(v) || 0)));
  }
  return out;
}

function resolvePurchaseQuantities(input: CreateDepositTransactionInput): {
  generalQty: number;
  dailyByEdition: Record<number, number>;
  extraPurchase?: PurchaseExtraInput;
} {
  if ("generalQty" in input) {
    const g = Math.max(0, Math.min(20, Math.trunc(input.generalQty)));
    const dailyByEdition = normalizeDailyByEditionInput(input.dailyByEdition);
    const legacyDaily = Math.max(0, Math.min(20, Math.trunc(Number(input.dailyQty) || 0)));
    if (legacyDaily > 0 && Object.keys(dailyByEdition).length === 0) {
      throw new Error("Selecione a edicao do bolao diario (Bolao Diario #N)");
    }
    const exQ = Math.max(0, Math.min(20, Math.trunc(Number(input.extraQuantity) || 0)));
    const rawMap = normalizeExtraByChampionship(input.extraByChampionship);
    let extraPurchase: PurchaseExtraInput | undefined;
    if (exQ > 0) extraPurchase = { extraQuantity: exQ };
    else if (Object.values(rawMap).some((v) => v > 0)) {
      extraPurchase = { extraByChampionship: rawMap };
    }
    return { generalQty: g, dailyByEdition, extraPurchase };
  }
  const single = input as
    | { ticketType: "general"; quantity: number }
    | { ticketType: "daily"; quantity: number; dailyEditionNumber?: number }
    | { ticketType: "extra"; quantity: number; extraChampionshipId: number };
  const q = Math.max(1, Math.min(20, Math.trunc(single.quantity)));
  if (single.ticketType === "general") {
    return { generalQty: q, dailyByEdition: {} };
  }
  if (single.ticketType === "daily") {
    const edition = Number(single.dailyEditionNumber);
    if (!Number.isFinite(edition) || edition <= 0) {
      throw new Error("dailyEditionNumber obrigatorio para compra do bolao diario");
    }
    return { generalQty: 0, dailyByEdition: { [edition]: q } };
  }
  const cid = Math.trunc(single.extraChampionshipId);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { generalQty: 0, dailyByEdition: {} };
  }
  return {
    generalQty: 0,
    dailyByEdition: {},
    extraPurchase: { extraByChampionship: { [cid]: q } },
  };
}

export async function createDepositTransaction(input: CreateDepositTransactionInput): Promise<DepositTransactionView> {
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
  if (!billingUser.email || !billingUser.email.includes("@")) {
    throw new Error("E-mail do usuario invalido para pagamento");
  }

  const { generalQty, dailyByEdition, extraPurchase } = resolvePurchaseQuantities(input);
  const lines =
    "checkoutPromo" in input && input.checkoutPromo === "comprar-cotas"
      ? buildComprarCotasPromoTicketLines(generalQty)
      : buildPurchaseTicketLines(generalQty, dailyByEdition, extraPurchase);
  if (lines.length === 0) {
    throw new Error("Selecione pelo menos um ticket");
  }

  const dailyEditionNumbers = [
    ...new Set(
      lines
        .filter((l) => l.ticketType === "daily" && l.dailyEditionNumber != null)
        .map((l) => Number(l.dailyEditionNumber)),
    ),
  ];
  if (dailyEditionNumbers.length > 0) {
    const mainComp = getFootballMainCompetitionId();
    const matchMap = await fetchMatchesMap({ ensureCompetitionIds: [mainComp] }).catch(
      () => new Map(),
    );
    for (const edition of dailyEditionNumbers) {
      if (!isDailyEditionPurchaseOpen(edition, matchMap, mainComp)) {
        throw new Error(`Bolao Diario #${edition} ja encerrado para compra`);
      }
    }
  }

  const amountCents = lines.reduce((s, l) => s + l.unitCents, 0);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Valor do pedido invalido");
  }

  const primaryTicketType = lines[0]!.ticketType;
  const paymentExternalRef = `ticket_${randomUUID()}`;

  const userIds: string[] = [];
  const ticketTypes: string[] = [];
  const extraIds: Array<number | null> = [];
  const roundNumbers: Array<number | null> = [];
  const unitPrices: number[] = [];
  const totalAmounts: number[] = [];
  const externalRefs: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    userIds.push(input.userId);
    ticketTypes.push(line.ticketType);
    const extraId = line.ticketType === "extra" ? line.extraChampionshipId ?? null : null;
    extraIds.push(extraId);
    roundNumbers.push(
      line.ticketType === "daily" && line.dailyEditionNumber != null
        ? line.dailyEditionNumber
        : extraId != null && !isSkaleBolaoCompetition(extraId)
          ? getTicketShopExtraRoundNumber(extraId)
          : null,
    );
    unitPrices.push(line.unitCents);
    totalAmounts.push(line.unitCents);
    externalRefs.push(`${paymentExternalRef}:p${i}`);
  }
  // Checkout normal nunca cria cota gratuita aqui — brindes vão por
  // `claimExtraGiftForUser` (vide `lib/promotions/extra-gift.ts`).
  const ticketInsert = await pool.query<{ id: string }>(
    `INSERT INTO tickets (
       user_id, ticket_type, extra_championship_id, round_number, unit_price_cents, quantity,
       total_amount_cents, is_promo_bonus, status, external_ref
     )
     SELECT u, tt, e, rn, up, 1, ta, false, 'pending_payment', er
     FROM UNNEST(
       $1::uuid[],
       $2::ticket_type_enum[],
       $3::int[],
       $4::int[],
       $5::int[],
       $6::int[],
       $7::text[]
     ) AS t(u, tt, e, rn, up, ta, er)
     RETURNING id`,
    [userIds, ticketTypes, extraIds, roundNumbers, unitPrices, totalAmounts, externalRefs]
  );
  const ticketIds = ticketInsert.rows.map((r) => r.id);
  const ticketId = ticketIds[0]!;

  const txInsert = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
      user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request
    ) VALUES ($1, $2, $3::ticket_type_enum, $6, 'creating', $4, 'pix', $5, '{}'::jsonb)
    RETURNING id`,
    [input.userId, ticketId, primaryTicketType, amountCents, paymentExternalRef, PAYMENT_PROVIDER]
  );
  const transactionId = txInsert.rows[0]!.id;

  try {
    const gateway = await createSkalePixTransaction({
      amountCents,
      externalId: paymentExternalRef,
      customer: {
        name: billingUser.name.trim(),
        email: billingUser.email.trim(),
        phone: billingUser.phone,
        document: billingUser.cpf.replace(/\D/g, ""),
      },
      itemTitle:
        lines.length === 1
          ? `Cota ${lines[0]!.ticketType === "extra" ? "extra" : lines[0]!.ticketType}`
          : `Cotas Bolao (${lines.length})`,
    });
    const initialStatus = CASH_IN_INITIAL_STATUS;

    console.info("[payment/create] Skale PIX", {
      transactionId,
      amountCents,
      lineCount: lines.length,
      providerTransactionId: gateway.providerTransactionId,
      apiStatus: gateway.rawResponse.status,
      initialStatus,
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
        gateway.providerTransactionId,
        initialStatus,
        gateway.pixQrcode,
        gateway.pixEnd2EndId,
        JSON.stringify(gateway.rawRequest),
        JSON.stringify(gateway.rawResponse),
      ]
    );

    await pool.query(
      `UPDATE tickets
       SET transaction_id = $2, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ticketIds, transactionId]
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
      `UPDATE tickets SET status = 'failed', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [ticketIds]
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
  const safeStatus = normalizeGatewayStatus(String(input.status || "").trim() || "unknown");
  const providerTransactionId = input.providerTransactionId.trim();
  const pixEnd2EndId = input.pixEnd2EndId?.trim() || null;
  const pixQrcode = input.pixQrcode?.trim() || null;

  const updateTx = await pool.query<{ id: string; user_id: string; ticket_id: string; external_ref: string; previous_status: string; status: string; pix_qrcode: string | null; provider_transaction_id: string }>(
    `WITH matched AS (
       SELECT id, status AS previous_status
       FROM transactions
       WHERE provider_transaction_id = $1
          OR external_ref = $1
          OR id::text = $1
          OR ($4::text IS NOT NULL AND pix_end2end_id = $4)
          OR ($3::text IS NOT NULL AND pix_qrcode = $3)
       LIMIT 1
     )
     UPDATE transactions t
     SET status = CASE
           WHEN matched.previous_status IN ('paid', 'approved') THEN t.status
           ELSE $2
         END,
         pix_qrcode = COALESCE($3, t.pix_qrcode),
         pix_end2end_id = COALESCE($4, t.pix_end2end_id),
         raw_webhook = COALESCE($5::jsonb, t.raw_webhook),
         updated_at = now()
     FROM matched
     WHERE t.id = matched.id
     RETURNING t.id, t.user_id, t.ticket_id, t.external_ref, matched.previous_status, t.status, t.pix_qrcode, t.provider_transaction_id`,
    [
      providerTransactionId,
      safeStatus,
      pixQrcode,
      pixEnd2EndId,
      input.rawWebhook ? JSON.stringify(input.rawWebhook) : null,
    ]
  );

  const row = updateTx.rows[0];
  if (!row?.ticket_id) {
    console.error("[payment/webhook] transaction not found", {
      providerTransactionId,
      pixEnd2EndId,
      hasPixQrcode: Boolean(pixQrcode),
      status: safeStatus,
    });
    return null;
  }

  const ticketStatus =
    safeStatus === "paid" || safeStatus === "approved"
      ? "paid"
      : safeStatus === "canceled" || safeStatus === "cancelled" || safeStatus === "refunded"
        ? "cancelled"
        : safeStatus === "expired"
          ? "expired"
          : safeStatus === "failed"
            ? "failed"
            : "pending_payment";
  const wasAlreadyPaid = row.previous_status === "paid" || row.previous_status === "approved";
  const incomingIsPaid = ticketStatus === "paid";

  const updatedTickets = await pool.query<{ id: string }>(
    `UPDATE tickets
     SET status = $2,
         paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
         updated_at = now()
     WHERE transaction_id = $1
       AND NOT $3::boolean
     RETURNING id`,
    [row.id, ticketStatus, wasAlreadyPaid]
  );

  console.info("[payment/webhook] transaction processed", {
    transactionId: row.id,
    providerTransactionId: row.provider_transaction_id,
    externalRef: row.external_ref,
    previousStatus: row.previous_status,
    incomingStatus: safeStatus,
    effectiveStatus: row.status,
    ticketStatus,
    alreadyProcessed: wasAlreadyPaid,
    updatedTickets: updatedTickets.rowCount ?? updatedTickets.rows.length,
  });

  if (incomingIsPaid && !wasAlreadyPaid) {
    try {
      await recordReferralCommissionIfApplicable({
        buyerUserId: row.user_id,
        transactionId: row.id,
      });
    } catch (e) {
      console.error("[referral] commission on paid transaction", e);
    }
    try {
      const { rows: generalTicketRows } = await pool.query<{ id: string }>(
        `SELECT id FROM tickets
         WHERE transaction_id = $1 AND ticket_type = 'general'
         LIMIT 1`,
        [row.id],
      );
      if (generalTicketRows.length > 0) {
        await validateBrasilMarrocosPlacarPromoSubmission(row.user_id);
        invalidatePromoHubCache(row.user_id);
      }
    } catch (e) {
      console.error("[promo] validate brasil-marrocos on paid transaction", e);
    }
    try {
      await postPaymentApprovedWebhookIfConfigured({
        transactionId: row.id,
        userId: row.user_id,
        gatewayLatestPayload: input.rawWebhook ?? null,
      });
    } catch (e) {
      console.error("[payment-approved-webhook] unexpected", e);
    }
  }

  publishTransactionEvent({
    transactionId: row.id,
    status: row.status,
    pixQrcode: row.pix_qrcode,
    providerTransactionId: row.provider_transaction_id,
  });
  return {
    transactionId: row.id,
    userId: row.user_id,
    status: row.status,
    pixQrcode: row.pix_qrcode,
    providerTransactionId: row.provider_transaction_id,
  };
}

export function parseTicketTypeOrThrow(input: unknown): TicketType {
  const t = parseTicketType(input);
  if (!t) throw new Error("ticketType invalido. Use 'general', 'daily' ou 'extra'.");
  return t;
}
