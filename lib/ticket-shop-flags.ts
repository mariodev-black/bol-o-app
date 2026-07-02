/** Flags de vitrine/loja (`TICKETS_*` no .env). */

import { isPremierLeagueExtraChampionship } from "@/lib/boloes-extra-competition-branding";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { isSkaleDailyBolaoCompetition } from "@/lib/boloes/skale-daily-config";

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

/**
 * Quando `WALLET_CHECKOUT_ENABLED=1`, o checkout passa a debitar o saldo da
 * carteira em vez de gerar PIX por compra. Default OFF — checkout segue idêntico
 * ao atual (PIX direto), então o deploy não muda o funil até ser ligado.
 */
export function isWalletCheckoutEnabled(): boolean {
  return parseEnvBool(process.env.WALLET_CHECKOUT_ENABLED);
}

/** Loja `/tickets` — Premier e Skale têm checkout dedicado. */
export function filterTicketShopExtraChampionshipIds(ids: number[]): number[] {
  return ids.filter(
    (id) =>
      !isPremierLeagueExtraChampionship(id) &&
      !isSkaleBolaoCompetition(id) &&
      !isSkaleDailyBolaoCompetition(id),
  );
}

export function filterTicketShopExtraBoloes<T extends { championshipId: number }>(
  items: T[],
): T[] {
  return items.filter(
    (b) =>
      !isPremierLeagueExtraChampionship(b.championshipId) &&
      !isSkaleBolaoCompetition(b.championshipId) &&
      !isSkaleDailyBolaoCompetition(b.championshipId),
  );
}
