import { extraBolaoFallbackDisplayName } from "@/lib/boloes-extra-competition-branding";
import { warmCompetitionMetadataCache } from "@/lib/competition-metadata-cache";
import { listPaidTicketsForUser } from "@/lib/payments/user-tickets";

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
  unusedPalpites: boolean;
  palpitesHref: string;
};

function shortId(id: string): string {
  const t = id.trim();
  if (t.length <= 8) return t.toUpperCase();
  return `${t.slice(0, 4)}…${t.slice(-4)}`.toUpperCase();
}

function palpitesHrefForTicket(ticketId: string | null): string {
  if (!ticketId) return "/palpites";
  return `/palpites?ticket=${encodeURIComponent(ticketId)}`;
}

export async function buildRankingScopes(
  userId: string,
  options?: { defaultRequested?: string | null }
): Promise<{ scopes: RankingScopeOption[]; defaultKey: string | null; hasAnyTicket: boolean }> {
  const scopes: RankingScopeOption[] = [];

  try {
    const tickets = await listPaidTicketsForUser(userId);
    const general = tickets.filter((t) => t.ticketType === "general");
    const daily = tickets.filter((t) => t.ticketType === "daily");
    const extra = tickets.filter((t) => t.ticketType === "extra");

    if (general.length > 0) {
      const unused = general.some((t) => (t.availableGames ?? 0) > 0);
      scopes.push({
        key: "principal",
        mode: "principal",
        ticketId: null,
        label: "Bolão geral — Copa do Mundo 2026",
        meta: `${general.length} cota${general.length === 1 ? "" : "s"} no bolão principal`,
        selectPrimary: "Bolão geral",
        selectSecondary: "Copa do Mundo 2026",
        extraChampionshipId: null,
        unusedPalpites: unused,
        palpitesHref: "/palpites",
      });
    }

    for (const t of daily) {
      const date = t.playDate?.trim() || "Dia";
      const unused = (t.availableGames ?? 0) > 0;
      scopes.push({
        key: `diario:${t.id}`,
        mode: "diario",
        ticketId: t.id,
        label: `Bolão do dia — ${date}`,
        meta: `Cota ${shortId(t.id)}`,
        selectPrimary: "Bolão do dia",
        selectSecondary: date,
        extraChampionshipId: null,
        unusedPalpites: unused,
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
    const compNames: Record<number, string> =
      uniqExtraCompIds.length > 0
        ? await warmCompetitionMetadataCache(uniqExtraCompIds).catch(() => ({}))
        : {};

    for (let i = 0; i < extraSorted.length; i++) {
      const t = extraSorted[i]!;
      const date = t.playDate?.trim() || "Dia";
      const compId = t.extraChampionshipId;
      const championshipName =
        compId != null && Number.isFinite(compId) && compNames[compId]
          ? compNames[compId]!
          : compId != null && Number.isFinite(compId)
            ? extraBolaoFallbackDisplayName(compId)
            : "Bolão extra";
      const ordinalSuffix = extraSorted.length > 1 ? ` · #${i + 1}` : "";
      const unused = (t.availableGames ?? 0) > 0;
      scopes.push({
        key: `extra:${t.id}`,
        mode: "extra",
        ticketId: t.id,
        label: `${championshipName} — ${date}${ordinalSuffix}`,
        meta: `Cota ${shortId(t.id)}`,
        selectPrimary: championshipName,
        selectSecondary: `${date}${ordinalSuffix}`,
        extraChampionshipId: compId ?? null,
        unusedPalpites: unused,
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
