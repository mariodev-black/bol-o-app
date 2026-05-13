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
        unusedPalpites: unused,
        palpitesHref: palpitesHrefForTicket(t.id),
      });
    }

    for (const t of extra) {
      const date = t.playDate?.trim() || "Dia";
      const comp = t.extraChampionshipId != null ? String(t.extraChampionshipId) : "?";
      const unused = (t.availableGames ?? 0) > 0;
      scopes.push({
        key: `extra:${t.id}`,
        mode: "extra",
        ticketId: t.id,
        label: `Bolão extra (${comp}) — ${date}`,
        meta: `Cota ${shortId(t.id)}`,
        selectPrimary: `Bolão extra (${comp})`,
        selectSecondary: date,
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
