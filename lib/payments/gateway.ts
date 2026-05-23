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

/** Normaliza status do gateway para o fluxo interno / UI. */
export function normalizeGatewayStatus(status: string): string {
  const s = String(status || "").trim().toUpperCase();
  if (s === "PAID" || s === "APPROVED" || s === "SUCCESS" || s === "COMPLETED") {
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
