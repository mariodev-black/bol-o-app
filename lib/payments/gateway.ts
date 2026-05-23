/** Provedor PIX ativo e helpers compartilhados. */

export const PAYMENT_PROVIDER = "3xpay" as const;

export type PaymentProviderName = typeof PAYMENT_PROVIDER | "skale";

export function appUrl(): string {
  return (process.env.APP_URL || "https://bolaodomilhao.com.br").trim().replace(/\/+$/, "");
}

export function paymentWebhookUrl(): string {
  const explicit = process.env.THREEXPAY_CALLBACK_URL?.trim();
  if (explicit) return explicit;
  return `${appUrl()}/api/webhooks/threexpay`;
}

/** 3xPay espera valor em reais (ex.: 39.9 para R$ 39,90). */
export function centsToGatewayAmount(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

/** Status que indicam PIX liquidado (não confundir com SUCCESS da API = cash-in criado). */
export function isGatewayPaymentSettled(status: string): boolean {
  const s = String(status || "").trim().toUpperCase();
  return s === "PAID" || s === "APPROVED" || s === "COMPLETED" || s === "CONFIRMED";
}

/** Webhook 3xPay: só este status dispara fluxo de pagamento confirmado. */
export function isThreeXPayWebhookPaidStatus(transactionStatus: string | undefined): boolean {
  return String(transactionStatus ?? "").trim().toUpperCase() === "PAID";
}

/** Status gravado ao criar cash-in (sempre aguardando PIX; confirmação só via webhook PAID). */
export const CASH_IN_INITIAL_STATUS = "waiting_payment" as const;

/** Normaliza status do gateway para o fluxo interno / UI. */
export function normalizeGatewayStatus(status: string): string {
  const s = String(status || "").trim().toUpperCase();
  if (isGatewayPaymentSettled(status)) {
    return "paid";
  }
  if (
    s === "PENDING" ||
    s === "WAITING" ||
    s === "WAITING_PAYMENT" ||
    s === "PROCESSING"
  ) {
    return "waiting_payment";
  }
  if (s === "CANCELLED" || s === "CANCELED") return "cancelled";
  if (s === "EXPIRED") return "expired";
  if (s === "FAILED" || s === "REJECTED") return "failed";
  return String(status || "").trim().toLowerCase() || "unknown";
}
