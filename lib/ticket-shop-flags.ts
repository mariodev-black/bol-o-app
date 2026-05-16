/** Flags de vitrine/loja (`TICKETS_*` no .env). */

export function parseEnvBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export type TicketShopFlags = {
  /** Oculta geral + diário; só extras na loja. */
  ticketsExtraOnly: boolean;
  /** Oculta só o bolão do dia na compra/vitrine (geral + extra permanecem). */
  ticketsHideDaily: boolean;
};

export function getTicketShopFlags(): TicketShopFlags {
  const ticketsExtraOnly = parseEnvBool(process.env.TICKETS_EXTRA_ONLY);
  const ticketsHideDaily =
    parseEnvBool(process.env.TICKETS_HIDE_DAILY) && !ticketsExtraOnly;
  return { ticketsExtraOnly, ticketsHideDaily };
}
