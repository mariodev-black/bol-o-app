import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import {
  CASH_IN_INITIAL_STATUS,
  PAYMENT_PROVIDER,
} from "@/lib/payments/gateway";
import { createSkalePixTransaction } from "@/lib/payments/skalepayments";
import { findBillingUserById } from "@/lib/payments/transactions";

export type WalletDepositView = {
  id: string;
  status: string;
  amountCents: number;
  pixQrcode: string | null;
  pixEnd2EndId: string | null;
  providerTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
};

function minDepositCents(): number {
  const raw = process.env.WALLET_DEPOSIT_MIN_CENTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1000; // R$ 10,00
}

/**
 * Cria um depósito PIX que credita a CARTEIRA (sem ticket). Reaproveita 100% o
 * pipeline Skale; a transação fica marcada com `purpose='wallet_deposit'` e o
 * crédito no ledger acontece no webhook `paid` (idempotente por transaction id).
 */
export async function createWalletDeposit(input: {
  userId: string;
  amountCents: number;
}): Promise<WalletDepositView> {
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

  const amountCents = Math.trunc(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < minDepositCents()) {
    throw new Error(`Valor minimo para depósito: R$ ${(minDepositCents() / 100).toFixed(2)}`);
  }

  const externalRef = `wallet_${randomUUID()}`;

  const txInsert = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
       user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, purpose, raw_request
     ) VALUES ($1, NULL, NULL, $4, 'creating', $2, 'pix', $3, 'wallet_deposit', '{}'::jsonb)
     RETURNING id`,
    [input.userId, amountCents, externalRef, PAYMENT_PROVIDER]
  );
  const transactionId = txInsert.rows[0]!.id;

  try {
    const gateway = await createSkalePixTransaction({
      amountCents,
      externalId: externalRef,
      customer: {
        name: billingUser.name.trim(),
        email: billingUser.email.trim(),
        phone: billingUser.phone,
        document: billingUser.cpf.replace(/\D/g, ""),
      },
      itemTitle: "Adicionar saldo — Carteira",
    });

    const { rows } = await pool.query<{
      id: string;
      status: string;
      amount_cents: number;
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
       RETURNING id, status, amount_cents, pix_qrcode, pix_end2end_id, provider_transaction_id, created_at, updated_at`,
      [
        transactionId,
        gateway.providerTransactionId,
        CASH_IN_INITIAL_STATUS,
        gateway.pixQrcode,
        gateway.pixEnd2EndId,
        JSON.stringify(gateway.rawRequest),
        JSON.stringify(gateway.rawResponse),
      ]
    );

    const row = rows[0]!;
    console.info("[wallet/deposit] Skale PIX", {
      transactionId,
      amountCents,
      providerTransactionId: gateway.providerTransactionId,
    });

    return {
      id: row.id,
      status: row.status,
      amountCents: row.amount_cents,
      pixQrcode: row.pix_qrcode,
      pixEnd2EndId: row.pix_end2end_id,
      providerTransactionId: row.provider_transaction_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  } catch (error) {
    await pool.query(
      `UPDATE transactions
         SET status = 'failed',
             raw_response = jsonb_build_object('error', $2::text),
             updated_at = now()
       WHERE id = $1`,
      [transactionId, error instanceof Error ? error.message : "Erro ao criar deposito"]
    );
    throw error;
  }
}
