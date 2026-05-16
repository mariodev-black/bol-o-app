/** Tipos e helpers puros do seletor de ranking (seguros para Client Components). */

export type RankingScopeStatus = "ativa" | "aguardando" | "encerrado";

export type RankingScopeOption = {
  key: string;
  mode: "principal" | "diario" | "extra";
  ticketId: string | null;
  /** Texto completo (ex.: listas e acessibilidade). */
  label: string;
  meta: string;
  /** Primeira linha do gatilho do select no ranking (título do bolão, sem data). */
  selectPrimary: string;
  /** Segunda linha: data (dia/extra) ou subtítulo do bolão (ex.: competição no geral). */
  selectSecondary: string;
  /** Bolão extra: id do campeonato na API (selo / ícone no ranking). */
  extraChampionshipId?: number | null;
  status: RankingScopeStatus;
  statusLabel: string;
  unusedPalpites: boolean;
  palpitesHref: string;
};

export function palpitesHrefForTicket(ticketId: string | null): string {
  const id = ticketId?.trim();
  if (!id) return "/palpites";
  return `/palpites?${new URLSearchParams({ ticket: id }).toString()}`;
}

/** URL de palpites alinhada à cota do escopo (ranking, CTAs). */
export function palpitesHrefForScope(
  scope: Pick<RankingScopeOption, "ticketId" | "palpitesHref">,
): string {
  return palpitesHrefForTicket(scope.ticketId);
}
