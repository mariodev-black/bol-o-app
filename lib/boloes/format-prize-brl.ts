/** Formata centavos em BRL (pt-BR). */
export function formatBrlFromCents(cents: number): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPositionOrdinal(position: number | null | undefined): string {
  if (position == null || !Number.isFinite(position) || position <= 0) return "—";
  return `${position}º`;
}
