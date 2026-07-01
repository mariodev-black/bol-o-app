/** Tipos e helpers puros do seletor de ranking (seguros para Client Components). */

export type RankingScopeStatus = "ativa" | "aguardando" | "encerrado";

export type RankingScopeOption = {
  key: string;
  mode: "principal" | "diario" | "extra" | "dynamic";
  /** Bolão admin (`bolao_definitions.id`) quando mode === "dynamic". */
  definitionId: string | null;
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
  /** Jogos ainda sem palpite neste escopo. */
  pendingPalpitesCount: number;
  /** Palpites já enviados neste escopo (cota ou cotas do geral). */
  palpitesSentCount: number;
  /** Rodada / período exibido no card do bolão (ex.: "17ª Rodada", "23/05/2026"). */
  roundLabel: string | null;
  palpitesHref: string;
};

/** Chave usada em `/ranking?default=` para escopo dinâmico ou legado. */
export function rankingDefaultScopeKey(
  ticketId: string | null,
  definitionId?: string | null,
): string | null {
  if (definitionId?.trim()) return `def:${definitionId.trim()}`;
  return ticketId?.trim() || null;
}

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
