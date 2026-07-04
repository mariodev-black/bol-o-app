const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 1099 -> "R$ 10,99" */
export function formatBRLFromCents(cents: number): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  return BRL.format(value);
}
