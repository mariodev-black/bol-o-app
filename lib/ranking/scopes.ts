import "server-only";

import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { warmCompetitionMetadataCache } from "@/lib/competition-metadata-cache";
import {
  extraBolaoCurrentRoundsByChampionship,
  type ExtraBolaoRoundInfo,
} from "@/lib/ticket-shop-extra-rounds";
import {
  listPaidTicketsForUser,
  type PaidTicketRow,
} from "@/lib/payments/user-tickets";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { fetchMatchesMap } from "@/lib/football-api";
import {
  palpitesHrefForTicket,
  type RankingScopeOption,
} from "@/lib/ranking/scopes-shared";
import {
  rankingScopeStatusForGeneralTickets,
  rankingScopeStatusForTicket,
} from "@/lib/ranking/scope-status";

export type { RankingScopeOption, RankingScopeStatus } from "@/lib/ranking/scopes-shared";
export { palpitesHrefForScope, palpitesHrefForTicket } from "@/lib/ranking/scopes-shared";

function competitionIdsEnsureFromPaidTickets(tickets: PaidTicketRow[]): number[] {
  const sole = getSoleConfiguredExtraChampionshipId();
  const mainComp = getFootballMainCompetitionId();
  const out = new Set<number>([mainComp]);
  for (const t of tickets) {
    if (t.ticketType !== "extra") continue;
    const c = Number(t.extraChampionshipId);
    if (Number.isFinite(c) && c > 0) out.add(c);
    else if (sole != null && sole > 0) out.add(sole);
  }
  return [...out];
}

function shortId(id: string): string {
  const t = id.trim();
  if (t.length <= 8) return t.toUpperCase();
  return `${t.slice(0, 4)}…${t.slice(-4)}`.toUpperCase();
}

export async function buildRankingScopes(
  userId: string,
  options?: { defaultRequested?: string | null },
): Promise<{ scopes: RankingScopeOption[]; defaultKey: string | null; hasAnyTicket: boolean }> {
  const scopes: RankingScopeOption[] = [];

  try {
    const tickets = await listPaidTicketsForUser(userId);
    const ensureCompIds = competitionIdsEnsureFromPaidTickets(tickets);
    const matches = await fetchMatchesMap({ ensureCompetitionIds: ensureCompIds }).catch(
      () => new Map(),
    );
    const general = tickets.filter((t) => t.ticketType === "general");
    const daily = tickets.filter((t) => t.ticketType === "daily");
    const extra = tickets.filter((t) => t.ticketType === "extra");

    if (general.length > 0) {
      const unused = general.some((t) => (t.availableGames ?? 0) > 0);
      const pendingPalpitesCount = general.reduce(
        (acc, t) => acc + Math.max(0, t.availableGames ?? 0),
        0,
      );
      const palpitesSentCount = general.reduce(
        (acc, t) => acc + Math.max(0, t.palpitesCount ?? 0),
        0,
      );
      const generalForPalpites =
        general.find((t) => (t.availableGames ?? 0) > 0) ?? general[0]!;
      scopes.push({
        key: "principal",
        mode: "principal",
        ticketId: generalForPalpites.id,
        label: "Bolão geral — Copa do Mundo 2026",
        meta: `${general.length} cota${general.length === 1 ? "" : "s"} no bolão principal`,
        selectPrimary: "Bolão geral",
        selectSecondary: "Copa do Mundo 2026",
        extraChampionshipId: null,
        ...rankingScopeStatusForGeneralTickets(general, matches),
        unusedPalpites: unused,
        pendingPalpitesCount,
        palpitesSentCount,
        roundLabel: "Todas as rodadas",
        palpitesHref: palpitesHrefForTicket(generalForPalpites.id),
      });
    }

    for (const t of daily) {
      const date = t.playDate?.trim() || "Dia";
      const unused = (t.availableGames ?? 0) > 0;
      const pendingPalpitesCount = Math.max(0, t.availableGames ?? 0);
      const palpitesSentCount = Math.max(0, t.palpitesCount ?? 0);
      scopes.push({
        key: `diario:${t.id}`,
        mode: "diario",
        ticketId: t.id,
        label: `Bolão do dia — ${date}`,
        meta: `Cota ${shortId(t.id)}`,
        selectPrimary: "Bolão do dia",
        selectSecondary: date,
        extraChampionshipId: null,
        ...rankingScopeStatusForTicket(t, matches),
        unusedPalpites: unused,
        pendingPalpitesCount,
        palpitesSentCount,
        roundLabel: `Jogos de ${date}`,
        palpitesHref: palpitesHrefForTicket(t.id),
      });
    }

    const extraSorted = [...extra].sort((a, b) => {
      const ta = String(a.paidAt || a.createdAt || "");
      const tb = String(b.paidAt || b.createdAt || "");
      if (ta !== tb) return ta.localeCompare(tb);
      return a.id.localeCompare(b.id);
    });

    const uniqExtraCompIds = [
      ...new Set(
        extraSorted
          .map((t) => t.extraChampionshipId)
          .filter((n): n is number => n != null && Number.isFinite(n) && n > 0),
      ),
    ];
    const [compNames, extraRounds] = await Promise.all([
      uniqExtraCompIds.length > 0
        ? warmCompetitionMetadataCache(uniqExtraCompIds).catch(
            () => ({}) as Record<number, string>,
          )
        : Promise.resolve({} as Record<number, string>),
      uniqExtraCompIds.length > 0
        ? extraBolaoCurrentRoundsByChampionship(uniqExtraCompIds).catch(
            () => ({}) as Record<number, ExtraBolaoRoundInfo>,
          )
        : Promise.resolve({} as Record<number, ExtraBolaoRoundInfo>),
    ]);

    for (let i = 0; i < extraSorted.length; i++) {
      const t = extraSorted[i]!;
      const date = t.playDate?.trim() || "Dia";
      const compId = t.extraChampionshipId;
      const championshipName =
        compId != null && Number.isFinite(compId)
          ? resolveExtraBolaoDisplayName(compId, compNames[compId])
          : "Bolão extra";
      const ordinalSuffix = extraSorted.length > 1 ? ` · #${i + 1}` : "";
      const unused = (t.availableGames ?? 0) > 0;
      const pendingPalpitesCount = Math.max(0, t.availableGames ?? 0);
      const palpitesSentCount = Math.max(0, t.palpitesCount ?? 0);
      const roundInfo = compId != null ? extraRounds[compId] : undefined;
      const ticketRound =
        t.extraRoundNumber != null &&
        Number.isFinite(Number(t.extraRoundNumber)) &&
        Number(t.extraRoundNumber) > 0
          ? Number(t.extraRoundNumber)
          : null;
      const roundLabel = isSkaleBolaoCompetition(compId)
        ? "Copa inteira"
        : ticketRound != null
          ? `${ticketRound}ª Rodada`
          : roundInfo?.roundLabel?.trim() || null;
      const selectPrimary = roundLabel
        ? `${championshipName} · ${roundLabel}`
        : championshipName;
      scopes.push({
        key: `extra:${t.id}`,
        mode: "extra",
        ticketId: t.id,
        label: `${championshipName} — ${date}${ordinalSuffix}`,
        meta: `Cota ${shortId(t.id)}`,
        selectPrimary,
        selectSecondary: `${date}${ordinalSuffix}`,
        extraChampionshipId: compId ?? null,
        ...rankingScopeStatusForTicket(t, matches),
        unusedPalpites: unused,
        pendingPalpitesCount,
        palpitesSentCount,
        roundLabel,
        palpitesHref: palpitesHrefForTicket(t.id),
      });
    }
  } catch (e) {
    console.error("[ranking/scopes-build]", e);
  }

  const defaultKey = scopes[0]?.key ?? null;
  const requested = options?.defaultRequested?.trim();
  const defaultKeyResolved =
    requested && scopes.some((s) => s.key === requested) ? requested : defaultKey;

  return {
    scopes,
    defaultKey: defaultKeyResolved,
    hasAnyTicket: scopes.length > 0,
  };
}
