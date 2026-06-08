/** Provedor PIX ativo e helpers compartilhados. */

export const PAYMENT_PROVIDER = "skale" as const;

export type PaymentProviderName = typeof PAYMENT_PROVIDER | "3xpay";

export function appUrl(): string {
  return (process.env.APP_URL || "https://bolaodomilhao.com.br").trim().replace(/\/+$/, "");
}

/** URL do webhook cadastrado no painel Skale Payments (nao enviado por transacao). */
export function skaleWebhookUrl(): string {
  return `${appUrl()}/api/webhooks/skale`;
}

/** @deprecated Legado 3xPay — valor em reais (ex.: 39.9 para R$ 39,90). */
export function centsToGatewayAmount(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

/** Status que indicam PIX liquidado. */
export function isGatewayPaymentSettled(status: string): boolean {
  const s = String(status || "").trim().toUpperCase();
  return s === "PAID" || s === "APPROVED" || s === "COMPLETED" || s === "CONFIRMED";
}

/** Webhook Skale: status `paid` confirma o pagamento. */
export function isSkaleWebhookPaidStatus(status: string | undefined): boolean {
  return String(status ?? "").trim().toLowerCase() === "paid";
}

/** @deprecated Mantido para webhook legado 3xPay. */
export function isThreeXPayWebhookPaidStatus(transactionStatus: string | undefined): boolean {
  return String(transactionStatus ?? "").trim().toUpperCase() === "PAID";
}

/** Status gravado ao criar cobrança PIX (confirmação via webhook/postback). */
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
  if (s === "FAILED" || s === "REJECTED" || s === "REFUSED") return "failed";
  if (s === "REFUNDED") return "refunded";
  return String(status || "").trim().toLowerCase() || "unknown";
}
