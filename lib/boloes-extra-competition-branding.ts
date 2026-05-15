import { isCopaDoBrasilChampionshipTitle } from "@/lib/boloes-copa-brasil-branding";

/**
 * IDs na API-Futebol v1 tratados como Brasileirão (ex. Série A = 10).
 * Sobrescreva com `BRASILEIRAO_EXTRA_CHAMPIONSHIP_IDS` (lista separada por vírgula).
 */
const DEFAULT_BRASILEIRAO_SERIE_A_IDS: readonly number[] = [10];

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

function brasileiraoExtraIdSet(): Set<number> {
  if (!brasileiraoIdSetMemo) {
    brasileiraoIdSetMemo = new Set(configuredBrasileiraoExtraIds());
  }
  return brasileiraoIdSetMemo;
}

/** Testes: limpa memo de env. */
export function resetBrasileiraoExtraIdSetForTests(): void {
  brasileiraoIdSetMemo = null;
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

export type ExtraBolaoHeroSideVariant = "copa_brasil" | "brasileirao" | "generic";

export function getExtraBolaoHeroSideVariant(
  championshipId: number | undefined | null,
  title: string | undefined | null,
): ExtraBolaoHeroSideVariant {
  if (isCopaDoBrasilChampionshipTitle(title)) return "copa_brasil";
  if (isBrasileiraoExtraChampionship(championshipId, title)) return "brasileirao";
  return "generic";
}

/** Nome curto quando não há metadata da API no cache. */
export function extraBolaoFallbackDisplayName(championshipId: number): string {
  if (brasileiraoExtraIdSet().has(championshipId)) return "Brasileirão";
  return `Campeonato ${championshipId}`;
}
