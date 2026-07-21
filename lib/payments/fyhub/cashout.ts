import { getFyhubAccountsAccessToken } from "@/lib/payments/fyhub/auth";
import {
  assertFyhubCashoutConfigured,
  fyhubIdempotencyKeyFromUuid,
} from "@/lib/payments/fyhub/config";
import { fyhubAccountsFetch, fyhubAccountsUrl } from "@/lib/payments/fyhub/http";

export type FyhubCashoutResult = {
  worked: boolean;
  /** ID numérico da ordem na Fyhub (grava em cartwave_transaction_id por compat). */
  transactionId: number | null;
  endToEndId: string | null;
  status: string | null;
  amount: number | null;
  idempotencyKey: string;
  raw: Record<string, unknown>;
};

export function pixKeyForFyhub(pixKeyType: string, pixKey: string): string {
  const key = pixKey.trim();
  if (pixKeyType === "phone") {
    const digits = key.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return key.startsWith("+") ? key : `+${digits}`;
  }
  if (pixKeyType === "email") return key.toLowerCase();
  if (pixKeyType === "cpf" || pixKeyType === "cnpj") return key.replace(/\D/g, "");
  return key;
}

/**
 * Cash-out por chave PIX — API Contas:
 * POST https://pagamentos.fyhub.com.br/api/v2/pix/payments/dict
 */
export async function createFyhubPixCashout(input: {
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  /** UUID da solicitação de saque (vira x-idempotency-key sem hífens). */
  withdrawalId: string;
  description?: string;
  creditorDocument?: string | null;
}): Promise<FyhubCashoutResult> {
  assertFyhubCashoutConfigured();

  const amount = Math.round(input.amountCents) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor de saque invalido para Fyhub");
  }

  const idempotencyKey = fyhubIdempotencyKeyFromUuid(input.withdrawalId);
  const pixKey = pixKeyForFyhub(input.pixKeyType, input.pixKey);
  const body: Record<string, unknown> = {
    pixKey,
    description: (input.description ?? `bolao-withdraw:${input.withdrawalId}`).slice(0, 140),
    paymentFlow: "INSTANT",
    payment: {
      currency: "BRL",
      amount,
    },
  };
  const doc = input.creditorDocument?.replace(/\D/g, "") ?? "";
  if (doc.length === 11 || doc.length === 14) {
    body.creditorDocument = doc;
  }

  const token = await getFyhubAccountsAccessToken();
  const res = await fyhubAccountsFetch(fyhubAccountsUrl("/pix/payments/dict"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Fyhub cashout retornou resposta invalida (${res.status})`);
  }

  if (!res.ok) {
    console.error("[fyhub/cashout]", { status: res.status, body: text.slice(0, 500) });
    const msg =
      (typeof raw.detail === "string" && raw.detail) ||
      (typeof raw.title === "string" && raw.title) ||
      (typeof raw.message === "string" && raw.message) ||
      `Fyhub cashout falhou (${res.status})`;
    throw new Error(msg);
  }

  const transactionId =
    typeof raw.id === "number"
      ? raw.id
      : typeof raw.id === "string" && /^\d+$/.test(raw.id)
        ? Number(raw.id)
        : null;
  const endToEndId = typeof raw.endToEndId === "string" ? raw.endToEndId : null;

  return {
    worked: true,
    transactionId,
    endToEndId,
    status: typeof raw.type === "string" ? raw.type : "PROCESSING",
    amount:
      raw.payment &&
      typeof raw.payment === "object" &&
      typeof (raw.payment as { amount?: unknown }).amount === "number"
        ? (raw.payment as { amount: number }).amount
        : amount,
    idempotencyKey,
    raw,
  };
}
