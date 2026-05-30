import type { RankingScopeOption, RankingScopeStatus } from "@/lib/ranking/scopes-shared";

export function rankingScopeStatusSortRank(status: RankingScopeStatus): number {
  if (status === "aguardando") return 0;
  if (status === "ativa") return 1;
  return 2;
}

export function sortRankingScopes(
  scopes: RankingScopeOption[],
): RankingScopeOption[] {
  return [...scopes].sort((a, b) => {
    const d =
      rankingScopeStatusSortRank(a.status) -
      rankingScopeStatusSortRank(b.status);
    if (d !== 0) return d;
    return a.key.localeCompare(b.key);
  });
}

export function partitionScopesByStatus(scopes: RankingScopeOption[]) {
  const active = scopes.filter((s) => s.status !== "encerrado");
  const finished = scopes.filter((s) => s.status === "encerrado");
  return {
    active: sortRankingScopes(active),
    finished: sortRankingScopes(finished),
  };
}

function championshipLabelForExtra(scope: RankingScopeOption): string {
  const primary = scope.selectPrimary?.trim() ?? "";
  if (primary.includes(" · ")) return primary.split(" · ", 2)[0]!.trim();
  return "Bolão extra";
}

export type RankingExtraScopeGroup = {
  championshipId: number;
  label: string;
  items: RankingScopeOption[];
};

export type RankingScopesByKind = {
  principal: RankingScopeOption[];
  diario: RankingScopeOption[];
  extraGroups: RankingExtraScopeGroup[];
};

export function groupScopesByKind(
  scopes: RankingScopeOption[],
): RankingScopesByKind {
  const principal = sortRankingScopes(
    scopes.filter((s) => s.mode === "principal"),
  );
  const diario = sortRankingScopes(scopes.filter((s) => s.mode === "diario"));

  const extraMap = new Map<number, RankingExtraScopeGroup>();
  for (const scope of scopes.filter((s) => s.mode === "extra")) {
    const championshipId = scope.extraChampionshipId ?? 0;
    const existing = extraMap.get(championshipId);
    if (existing) {
      existing.items.push(scope);
    } else {
      extraMap.set(championshipId, {
        championshipId,
        label: championshipLabelForExtra(scope),
        items: [scope],
      });
    }
  }

  const extraGroups = [...extraMap.values()].map((group) => ({
    ...group,
    items: sortRankingScopes(group.items),
  }));

  return { principal, diario, extraGroups };
}
