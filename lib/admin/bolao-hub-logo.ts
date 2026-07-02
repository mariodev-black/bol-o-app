import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import { isSkaleDailyBolaoCompetition } from "@/lib/boloes/skale-daily-config";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import {
  isExtraBolaoBrandedIcon,
  type ExtraBolaoIconVariant,
} from "@/app/shared/extra-bolao-icons";

type LogoInput = Pick<
  BolaoDefinition,
  "id" | "slug" | "ticketType" | "competitionId" | "logoVariant" | "displayName" | "logoUrl"
> & {
  isLegacy?: boolean;
};

const STATIC_ICON_VARIANTS = new Set<ExtraBolaoIconVariant>([
  "copa_mundo",
  "copa",
  "artilheiros",
  "daily",
  "skale",
  "amistosos",
  "copa_brasil",
  "brasileirao",
  "serie_b",
  "premier_league",
  "libertadores",
]);

function shouldPreferStaticIcon(
  input: LogoInput,
  iconVariant: ExtraBolaoIconVariant,
): boolean {
  if (input.logoUrl?.trim()) return false;
  if (!STATIC_ICON_VARIANTS.has(iconVariant) && !isExtraBolaoBrandedIcon(iconVariant)) {
    return false;
  }
  if (input.isLegacy || input.id.startsWith("legacy:")) return true;
  if (input.ticketType === "daily") return true;
  if (input.ticketType === "general" && iconVariant === "copa_mundo") return true;
  if (iconVariant === "artilheiros" || iconVariant === "amistosos" || iconVariant === "skale") {
    return true;
  }
  if (input.ticketType === "extra" && iconVariant !== "generic") return true;
  return false;
}

/** Ícone correto para cards do hub admin (legado + dinâmico). */
export function resolveAdminBolaoHubIconVariant(input: LogoInput): ExtraBolaoIconVariant {
  const raw = input.logoVariant?.trim().toLowerCase();
  if (raw === "copa_mundo" || raw === "copa") return "copa_mundo";
  if (raw === "artilheiros") return "artilheiros";
  if (raw === "daily") return "daily";
  if (raw === "skale") return "skale";
  if (raw === "amistosos") return "amistosos";

  if (input.id.startsWith("legacy:artilheiros") || input.slug === "bolao-artilheiros") {
    return "artilheiros";
  }
  if (input.id.startsWith("legacy:amistosos") || input.slug === "bolao-amistosos") {
    return "amistosos";
  }
  if (input.id.startsWith("legacy:principal") || input.slug === "bolao-principal") {
    return "copa_mundo";
  }
  if (input.id.startsWith("legacy:daily:") || input.slug.startsWith("bolao-diario-")) {
    if (isSkaleDailyBolaoCompetition(input.competitionId)) return "skale";
    return "daily";
  }
  if (
    input.slug.startsWith("bolao-skale") ||
    isSkaleBolaoCompetition(input.competitionId) ||
    isSkaleDailyBolaoCompetition(input.competitionId)
  ) {
    return "skale";
  }

  if (input.ticketType === "general") return "copa_mundo";
  if (input.ticketType === "daily") return "daily";

  const mainComp = getFootballMainCompetitionId();
  if (input.competitionId === mainComp && input.ticketType === "extra") {
    return getExtraBolaoHeroSideVariant(input.competitionId, input.displayName);
  }

  const variant = getExtraBolaoHeroSideVariant(input.competitionId, input.displayName);
  if (variant !== "generic") return variant;

  if (input.competitionId === mainComp) return "copa_mundo";

  return "generic";
}

export function applyAdminBolaoHubLogo<
  T extends LogoInput & { resolvedLogoUrl: string | null; resolvedIconVariant: string },
>(item: T): T {
  const iconVariant = resolveAdminBolaoHubIconVariant(item);
  const useStaticIcon = shouldPreferStaticIcon(item, iconVariant);

  return {
    ...item,
    resolvedIconVariant: iconVariant,
    resolvedLogoUrl: useStaticIcon
      ? null
      : item.resolvedLogoUrl?.trim()
        ? item.resolvedLogoUrl.trim()
        : item.logoUrl?.trim()
          ? item.logoUrl.trim()
          : null,
  };
}
