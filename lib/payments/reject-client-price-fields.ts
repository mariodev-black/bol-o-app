/** Campos que o cliente nunca deve enviar — o valor do PIX é calculado só no servidor. */
export const CLIENT_PRICE_FIELD_KEYS = [
  "amountCents",
  "unitPriceCents",
  "priceCents",
  "totalCents",
  "amount",
  "unitPrice",
  "totalAmountCents",
  "lineCents",
  "unitCents",
  "value",
  "total",
  "price",
  "subtotal",
  "unit_price_cents",
  "total_amount_cents",
] as const;

export function findClientPriceField(payload: Record<string, unknown>): string | null {
  for (const key of CLIENT_PRICE_FIELD_KEYS) {
    if (payload[key] != null) return key;
  }
  return null;
}

export function clientPriceFieldError(field: string): string {
  return `Campo "${field}" nao e aceito; o servidor calcula o valor do PIX`;
}
