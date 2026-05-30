import {
  getExtraBolaoHeroSideVariant,
  type ExtraBolaoHeroSideVariant,
} from "@/lib/boloes-extra-competition-branding";

export type ShowcasePrizeCopy = {
  total: string;
  first: string;
  firstPlaceLine?: string;
};

export const PRINCIPAL_MILHAO_FIRST_PLACE_LINE =
  "Bolão do Milhão: expectativa de R$ 180.000 para o 1º colocado.";

const EXTRA_FIRST_PLACE_BY_VARIANT: Record<ExtraBolaoHeroSideVariant, string> = {
  brasileirao: "Bolão do Brasileirão: R$ 1.000 para o 1º colocado.",
  libertadores: "Bolão da Libertadores: R$ 1.000 para o 1º colocado.",
  premier_league: "Bolão da Premier League: R$ 1.000 para o 1º colocado.",
  copa_brasil: "Bolão da Copa do Brasil: R$ 1.000 para o 1º colocado.",
  generic: "Bolão extra: R$ 1.000 para o 1º colocado.",
};

/** Linha de 1º colocado por campeonato extra (Brasileirão, Libertadores, etc.). */
export function getExtraBolaoFirstPlaceLine(
  championshipId?: number | null,
  title?: string | null,
): string {
  const variant = getExtraBolaoHeroSideVariant(
    championshipId ?? undefined,
    title ?? undefined,
  );
  return EXTRA_FIRST_PLACE_BY_VARIANT[variant];
}

export const SHOWCASE_PRIZES: Record<
  "principal" | "diario" | "extra",
  ShowcasePrizeCopy
> = {
  principal: {
    total: "R$ 1.000.000",
    first: "R$ 180.000",
    firstPlaceLine: PRINCIPAL_MILHAO_FIRST_PLACE_LINE,
  },
  diario: { total: "R$ 10.000", first: "R$ 5.000" },
  extra: { total: "R$ 10.000", first: "R$ 1.000" },
};
