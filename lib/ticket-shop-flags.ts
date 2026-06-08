/** Flags de vitrine/loja (`TICKETS_*` no .env). */

import { isPremierLeagueExtraChampionship } from "@/lib/boloes-extra-competition-branding";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";

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

/** Loja `/tickets` — Premier e Skale têm checkout dedicado. */
export function filterTicketShopExtraChampionshipIds(ids: number[]): number[] {
  return ids.filter(
    (id) => !isPremierLeagueExtraChampionship(id) && !isSkaleBolaoCompetition(id),
  );
}

export function filterTicketShopExtraBoloes<T extends { championshipId: number }>(
  items: T[],
): T[] {
  return items.filter(
    (b) =>
      !isPremierLeagueExtraChampionship(b.championshipId) &&
      !isSkaleBolaoCompetition(b.championshipId),
  );
}
