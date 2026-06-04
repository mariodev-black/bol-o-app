import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import type { ActiveBolaoListItem, BoloesScreenData } from "@/app/(authenticated)/boloes/BoloesClient";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import {
  extraBolaoIconSrc,
  isExtraBolaoBrandedIcon,
} from "@/app/shared/extra-bolao-icons";
import { getOutrosBolaoItemDefByChampionshipId } from "@/lib/boloes-outros-grid";

export type BoloesSheetItem = {
  id: string;
  filterKey: string;
  title: string;
  subtitle: string;
  href: string;
  priceLabel: string;
  prizeLine: string;
  iconSrc: string;
  brandedIcon: boolean;
};

export type BoloesSheetChampionshipOption = {
  value: string;
  label: string;
};

const CHAMPIONSHIP_LABELS: Record<string, string> = {
  principal: "Copa do Mundo 2026",
  diario: "Bolão do Dia",
};

function parseExtraTitleParts(title: string): { name: string; round: string | null } {
  const t = title.trim();
  if (!t.includes(" · ")) return { name: t, round: null };
  const [name, round] = t.split(" · ", 2);
  return { name: (name ?? t).trim(), round: round?.trim() || null };
}

function filterKeyForActive(item: ActiveBolaoListItem): string {
  if (item.type === "principal") return "principal";
  if (item.type === "diario") return "diario";
  return `extra:${item.championshipId ?? "unknown"}`;
}

function championshipLabelForFilterKey(filterKey: string): string {
  if (filterKey in CHAMPIONSHIP_LABELS) {
    return CHAMPIONSHIP_LABELS[filterKey]!;
  }
  if (filterKey.startsWith("extra:")) {
    const id = Number.parseInt(filterKey.slice("extra:".length), 10);
    const def = Number.isFinite(id)
      ? getOutrosBolaoItemDefByChampionshipId(id)
      : undefined;
    if (def) return def.label;
  }
  return filterKey;
}

function iconForActive(item: ActiveBolaoListItem): {
  iconSrc: string;
  brandedIcon: boolean;
} {
  if (item.type === "principal" || item.type === "diario") {
    return { iconSrc: iconCopaMundo.src, brandedIcon: true };
  }
  const { name } = parseExtraTitleParts(item.title);
  const variant = getExtraBolaoHeroSideVariant(item.championshipId, name);
  const icon = extraBolaoIconSrc(variant);
  return {
    iconSrc: icon.src,
    brandedIcon: isExtraBolaoBrandedIcon(variant),
  };
}

function activeToSheetItem(item: ActiveBolaoListItem): BoloesSheetItem {
  const { name, round } =
    item.type === "extra"
      ? parseExtraTitleParts(item.title)
      : { name: item.title, round: null };
  const icon = iconForActive(item);
  const position =
    item.position != null ? `${item.position}º no ranking` : null;

  return {
    id: item.id,
    filterKey: filterKeyForActive(item),
    title: name,
    subtitle:
      round ??
      (item.type === "diario"
        ? "Rodada do dia"
        : item.type === "principal"
          ? "Copa do Mundo 2026"
          : item.cotaLabel),
    href: item.href,
    priceLabel: item.cotaLabel,
    prizeLine: position ?? item.statusLabel,
    iconSrc: icon.iconSrc,
    brandedIcon: icon.brandedIcon,
  };
}

function filterActiveBoloes(
  items: ActiveBolaoListItem[],
  options: { ticketsExtraOnly: boolean; ticketsHideDaily: boolean },
): ActiveBolaoListItem[] {
  return items.filter((item) => {
    if (item.displayPhase === "finalizado") return false;
    if (options.ticketsExtraOnly && item.type === "principal") return false;
    if (options.ticketsHideDaily && item.type === "diario") return false;
    return true;
  });
}

export function buildBoloesSheetCatalog(
  data: BoloesScreenData | null,
  options: {
    ticketsExtraOnly?: boolean;
    ticketsHideDaily?: boolean;
  } = {},
): {
  items: BoloesSheetItem[];
  championships: BoloesSheetChampionshipOption[];
} {
  const ticketsExtraOnly = options.ticketsExtraOnly ?? false;
  const ticketsHideDaily = options.ticketsHideDaily ?? false;

  const activeOnly = filterActiveBoloes(data?.active.all ?? [], {
    ticketsExtraOnly,
    ticketsHideDaily,
  });

  const items = activeOnly.map(activeToSheetItem);

  const filterKeys = [...new Set(items.map((item) => item.filterKey))];
  const championships: BoloesSheetChampionshipOption[] = [
    { value: "all", label: "Todos os campeonatos" },
    ...filterKeys.map((value) => ({
      value,
      label: championshipLabelForFilterKey(value),
    })),
  ];

  return { items, championships };
}

export function filterBoloesSheetItems(
  items: BoloesSheetItem[],
  championshipValue: string,
): BoloesSheetItem[] {
  if (championshipValue === "all") return items;
  return items.filter((item) => item.filterKey === championshipValue);
}
