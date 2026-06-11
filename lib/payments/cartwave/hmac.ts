import { createHmac } from "node:crypto";

/** JSON compacto para assinatura HMAC-SHA512 (Cartwave). */
export function cartwaveNormalizeJsonBody(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload);
  return raw.replace(/:\s/g, ":").replace(/,\s/g, ",");
}

export function cartwaveSignBody(payload: Record<string, unknown>, secretKey: string): string {
  const body = cartwaveNormalizeJsonBody(payload);
  return createHmac("sha512", secretKey).update(body).digest("hex");
}
