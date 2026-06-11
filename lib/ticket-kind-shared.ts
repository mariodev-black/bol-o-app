/** Normaliza id vindo da URL (ex.: sufixo futuro) para lookup no Postgres. */
export function normalizeTicketIdForDbLookup(ticketId: string): string {
  return ticketId.trim().replace(/#\d+$/i, "");
}

/** Só prefixos locais (sem banco) — seguro importar em Client Components. */
export function inferBolaoTypeFromTicketPrefix(ticketId: string): "principal" | "diario" | null {
  const id = ticketId.trim().toUpperCase();
  if (!id) return null;
  if (id.startsWith("TG-")) return "principal";
  if (id.startsWith("TD-")) return "diario";
  if (id.startsWith("TA-")) return null;
  return null;
}
