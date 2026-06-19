import {
  getExtraBolaoHeroSideVariant,
  resolveExtraBolaoDisplayName,
} from "@/lib/boloes-extra-competition-branding";
import { formatDailyEditionDatesLabel } from "@/lib/boloes/daily-editions";
import type {
  AdminCompetitionOption,
  BolaoDefinition,
  BolaoDefinitionCatalogItem,
} from "@/lib/boloes/definitions/types";
import { getPool } from "@/lib/db";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { readCompetitionDisplayNamesFromDb } from "@/lib/competition-metadata-cache";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function datesLabelFromScope(def: BolaoDefinition): string | null {
  if (def.scopeMode !== "daily_dates" || def.scopeDates.length === 0) return null;
  const sorted = [...def.scopeDates].sort();
  if (sorted.length === 1) {
    return `dia ${sorted[0]}`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return `dias ${first}${sorted.length > 2 ? ` a ${last}` : ` e ${last}`}`;
}

export async function listAdminCompetitionOptions(): Promise<AdminCompetitionOption[]> {
  const pool = getPool();
  const ids = [...new Set([getFootballMainCompetitionId(), ...getAllSyncedCompetitionIds()])];
  const labels = await readCompetitionDisplayNamesFromDb(ids).catch(() => ({} as Record<number, string>));

  const { rows } = await pool.query<{
    competition_id: number;
    nome_popular: string | null;
    logo: string | null;
    rodada_atual_numero: number | null;
    rodada_atual_nome: string | null;
  }>(
    `SELECT competition_id, nome_popular, logo, rodada_atual_numero, rodada_atual_nome
       FROM championships_cache
      WHERE competition_id = ANY($1::int[])`,
    [ids],
  );

  const byId = new Map(rows.map((r) => [Number(r.competition_id), r]));

  return ids.map((id) => {
    const row = byId.get(id);
    const displayName =
      labels[id] ??
      row?.nome_popular?.trim() ??
      resolveExtraBolaoDisplayName(id, null);
    const iconVariant = getExtraBolaoHeroSideVariant(id, displayName);
    return {
      id,
      displayName,
      logoUrl: row?.logo?.trim() ? row.logo.trim() : null,
      iconVariant,
      currentRound: row?.rodada_atual_numero ?? null,
      currentRoundLabel: row?.rodada_atual_nome ?? null,
      isSynthetic: id >= 90000,
    };
  });
}

export async function resolveBolaoDefinitionBranding(
  def: BolaoDefinition,
  competitionLabels?: Record<number, string>,
): Promise<{
  competitionDisplayName: string;
  resolvedLogoUrl: string | null;
  resolvedIconVariant: string;
}> {
  const labels =
    competitionLabels ??
    (await readCompetitionDisplayNamesFromDb([def.competitionId]).catch(
      () => ({} as Record<number, string>),
    ));

  const competitionDisplayName =
    labels[def.competitionId] ?? resolveExtraBolaoDisplayName(def.competitionId, def.displayName);

  const iconVariant =
    def.logoVariant?.trim() ||
    getExtraBolaoHeroSideVariant(def.competitionId, competitionDisplayName);

  let resolvedLogoUrl: string | null = null;
  if (!def.useCompetitionLogo && def.logoUrl) {
    resolvedLogoUrl = def.logoUrl;
  } else if (def.logoUrl) {
    resolvedLogoUrl = def.logoUrl;
  } else {
    const pool = getPool();
    const { rows } = await pool.query<{ logo: string | null }>(
      `SELECT logo FROM championships_cache WHERE competition_id = $1 LIMIT 1`,
      [def.competitionId],
    );
    resolvedLogoUrl = rows[0]?.logo?.trim() ? rows[0].logo!.trim() : null;
  }

  return { competitionDisplayName, resolvedLogoUrl, resolvedIconVariant: iconVariant };
}

export async function enrichBolaoDefinitionCatalog(
  definitions: BolaoDefinition[],
): Promise<BolaoDefinitionCatalogItem[]> {
  const ids = [...new Set(definitions.map((d) => d.competitionId))];
  const labels = await readCompetitionDisplayNamesFromDb(ids).catch(
    () => ({} as Record<number, string>),
  );

  const out: BolaoDefinitionCatalogItem[] = [];
  for (const def of definitions) {
    const branding = await resolveBolaoDefinitionBranding(def, labels);
    out.push({
      ...def,
      ...branding,
      datesLabel: datesLabelFromScope(def),
      priceLabel: formatBRL(def.unitPriceCents),
    });
  }
  return out;
}

export { formatDailyEditionDatesLabel };
