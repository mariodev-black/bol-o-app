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

/** Top 10 — pool exemplo R$ 1M (mesmos valores oficiais de /premiacao). */
export const MILHAO_MARKETING_TOP_PRIZES = {
  first: "R$ 180.000",
  secondary: [
    { label: "2º Lugar", value: "R$ 90.000" },
    { label: "3º Lugar", value: "R$ 50.000" },
    { label: "4º Lugar", value: "R$ 35.000" },
    /** Soma dos prêmios do 5º ao 10º lugar no pool de exemplo. */
    { label: "5º - 10º", value: "R$ 84.000" },
  ],
} as const;

const EXTRA_FIRST_PLACE_BY_VARIANT: Record<ExtraBolaoHeroSideVariant, string> = {
  brasileirao: "Bolão do Brasileirão: R$ 1.000 para o 1º colocado.",
  serie_b: "Bolão Série B: R$ 10.000 em premiações — 1º R$ 1.000.",
  amistosos: "Bolão dos Amistosos: 1º R$ 1.000 · 2º R$ 500 · 3º R$ 300.",
  skale: "Bolão Skale: 1º 60% · 2º 30% · 3º 10% do valor arrecadado — pagamento ao final da Copa.",
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
  "principal" | "diario" | "extra" | "artilheiros",
  ShowcasePrizeCopy
> = {
  principal: {
    total: "R$ 1.000.000",
    first: "R$ 180.000",
    firstPlaceLine: PRINCIPAL_MILHAO_FIRST_PLACE_LINE,
  },
  diario: { total: "R$ 10.000", first: "R$ 5.000" },
  extra: { total: "R$ 10.000", first: "R$ 1.000" },
  artilheiros: {
    total: "ATÉ 100 PTS",
    first: "por cota",
    firstPlaceLine: "🥇 50 · 🥈 30 · 🥉 20 pts + bônus top 3",
  },
};
