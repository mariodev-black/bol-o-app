import { isCopaDoBrasilChampionshipTitle } from "@/lib/boloes-copa-brasil-branding";

/**
 * IDs na API-Futebol v1 tratados como Brasileirão (ex. Série A = 10).
 * Sobrescreva com `BRASILEIRAO_EXTRA_CHAMPIONSHIP_IDS` (lista separada por vírgula).
 */
const DEFAULT_BRASILEIRAO_SERIE_A_IDS: readonly number[] = [10];
/** Premier League na API-Futebol (ex.: id 69). */
const DEFAULT_PREMIER_LEAGUE_IDS: readonly number[] = [69];

function configuredBrasileiraoExtraIds(): number[] {
  const raw = process.env.BRASILEIRAO_EXTRA_CHAMPIONSHIP_IDS?.trim();
  if (raw === undefined || raw === "") {
    return [...DEFAULT_BRASILEIRAO_SERIE_A_IDS];
  }
  const parsed = raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_BRASILEIRAO_SERIE_A_IDS];
}

let brasileiraoIdSetMemo: Set<number> | null = null;
let premierLeagueIdSetMemo: Set<number> | null = null;

function brasileiraoExtraIdSet(): Set<number> {
  if (!brasileiraoIdSetMemo) {
    brasileiraoIdSetMemo = new Set(configuredBrasileiraoExtraIds());
  }
  return brasileiraoIdSetMemo;
}

function configuredPremierLeagueExtraIds(): number[] {
  const raw = process.env.PREMIER_LEAGUE_EXTRA_CHAMPIONSHIP_IDS?.trim();
  if (raw === undefined || raw === "") {
    return [...DEFAULT_PREMIER_LEAGUE_IDS];
  }
  const parsed = raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_PREMIER_LEAGUE_IDS];
}

function premierLeagueExtraIdSet(): Set<number> {
  if (!premierLeagueIdSetMemo) {
    premierLeagueIdSetMemo = new Set(configuredPremierLeagueExtraIds());
  }
  return premierLeagueIdSetMemo;
}

/** Testes: limpa memo de env. */
export function resetBrasileiraoExtraIdSetForTests(): void {
  brasileiraoIdSetMemo = null;
  premierLeagueIdSetMemo = null;
}

export function isPremierLeagueChampionshipTitle(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return n.includes("premier league") || n.includes("premier");
}

export function isPremierLeagueExtraChampionship(
  championshipId: number | undefined | null,
  title?: string | null,
): boolean {
  const id = championshipId != null && Number.isFinite(Number(championshipId)) ? Number(championshipId) : NaN;
  if (!Number.isNaN(id) && id > 0 && premierLeagueExtraIdSet().has(id)) return true;
  return isPremierLeagueChampionshipTitle(title ?? null);
}

export function isBrasileiraoChampionshipTitle(name: string | undefined | null): boolean {
  if (!name) return false;
  if (isCopaDoBrasilChampionshipTitle(name)) return false;
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("brasileirao")) return true;
  if (n.includes("serie a") || n.includes("serie-a")) return true;
  if (n.includes("campeonato brasileiro")) return true;
  return false;
}

export function isBrasileiraoExtraChampionship(
  championshipId: number | undefined | null,
  title?: string | null,
): boolean {
  const id = championshipId != null && Number.isFinite(Number(championshipId)) ? Number(championshipId) : NaN;
  if (!Number.isNaN(id) && id > 0 && brasileiraoExtraIdSet().has(id)) return true;
  return isBrasileiraoChampionshipTitle(title ?? null);
}

export type ExtraBolaoHeroSideVariant =
  | "copa_brasil"
  | "brasileirao"
  | "premier_league"
  | "generic";

export function getExtraBolaoHeroSideVariant(
  championshipId: number | undefined | null,
  title: string | undefined | null,
): ExtraBolaoHeroSideVariant {
  if (isCopaDoBrasilChampionshipTitle(title)) return "copa_brasil";
  if (isBrasileiraoExtraChampionship(championshipId, title)) return "brasileirao";
  if (isPremierLeagueExtraChampionship(championshipId, title)) return "premier_league";
  return "generic";
}

/** Nome curto quando não há metadata da API no cache. */
export function extraBolaoFallbackDisplayName(championshipId: number): string {
  if (brasileiraoExtraIdSet().has(championshipId)) return "Brasileirão";
  if (premierLeagueExtraIdSet().has(championshipId)) return "Premier League";
  return `Campeonato ${championshipId}`;
}

/** Ícone do card de extra no checkout: Copa BR > Brasileirão > Premier > ticket genérico. */
export type CheckoutExtraBolaoIconVariant =
  | "copa_brasil"
  | "brasileirao"
  | "premier_league"
  | "generic";

export function resolveCheckoutExtraBolaoIconVariant(
  extraBoloes: ReadonlyArray<{ championshipId: number; displayName?: string | undefined }>,
  resumoShortLabel: string,
): CheckoutExtraBolaoIconVariant {
  const label = resumoShortLabel.trim();
  for (const b of extraBoloes) {
    if (getExtraBolaoHeroSideVariant(b.championshipId, b.displayName) === "copa_brasil") {
      return "copa_brasil";
    }
  }
  if (isCopaDoBrasilChampionshipTitle(label)) return "copa_brasil";

  for (const b of extraBoloes) {
    if (getExtraBolaoHeroSideVariant(b.championshipId, b.displayName) === "brasileirao") {
      return "brasileirao";
    }
  }
  if (isBrasileiraoChampionshipTitle(label)) return "brasileirao";

  for (const b of extraBoloes) {
    if (getExtraBolaoHeroSideVariant(b.championshipId, b.displayName) === "premier_league") {
      return "premier_league";
    }
  }
  if (isPremierLeagueChampionshipTitle(label)) return "premier_league";

  return "generic";
}
