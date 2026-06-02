/** Ex.: `a1b2c3` para exibir no app (6 primeiros chars do UUID). */
export function formatShortTicketId(ticketId: string): string {
  const clean = ticketId.trim();
  if (!clean) return "------";
  return clean.replace(/-/g, "").slice(0, 6).toUpperCase();
}
