/**
 * Campeonatos exibidos no grid "Outros bolões" da home (/boloes).
 * IDs alinhados a env de branding (Brasileirão, Premier, La Liga).
 */

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function parseIdList(raw: string | undefined, fallback: number[]): number[] {
  if (!raw) return fallback;
  const parsed = raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : fallback;
}

function brasileiraoChampionshipId(): number {
  return parseIdList(env("BRASILEIRAO_EXTRA_CHAMPIONSHIP_IDS"), [10])[0]!;
}

function premierChampionshipId(): number {
  return parseIdList(env("PREMIER_LEAGUE_EXTRA_CHAMPIONSHIP_IDS"), [69])[0]!;
}

function laLigaChampionshipId(): number {
  return parseIdList(env("LA_LIGA_EXTRA_CHAMPIONSHIP_IDS"), [11])[0]!;
}

export type OutrosBolaoGridItem = {
  championshipId: number;
  label: string;
  participants: number;
};

/** Ordem fixa: Brasileirão → Premier League → La Liga (layout de referência). */
export function getOutrosBoloesGridItems(
  participantsByChampionship: Record<number, number>,
): OutrosBolaoGridItem[] {
  const brasileiraoId = brasileiraoChampionshipId();
  const premierId = premierChampionshipId();
  const laLigaId = laLigaChampionshipId();

  return [
    {
      championshipId: brasileiraoId,
      label: "BRASILEIRÃO",
      participants: participantsByChampionship[brasileiraoId] ?? 0,
    },
    {
      championshipId: premierId,
      label: "PREMIER LEAGUE",
      participants: participantsByChampionship[premierId] ?? 0,
    },
    {
      championshipId: laLigaId,
      label: "LA LIGA",
      participants: participantsByChampionship[laLigaId] ?? 0,
    },
  ];
}

export function getOutrosBoloesChampionshipIds(): number[] {
  return [
    brasileiraoChampionshipId(),
    premierChampionshipId(),
    laLigaChampionshipId(),
  ];
}
