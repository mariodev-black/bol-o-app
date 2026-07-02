import type { BolaoDefinition } from "@/lib/boloes/definitions/types";

/** IDs sintéticos (Skale, FDS, etc.) — não são campeonatos da API. */
export const SYNTHETIC_COMPETITION_ID_MIN = 90_000;

export function isSyntheticCompetitionId(competitionId: number): boolean {
  return Number.isFinite(competitionId) && competitionId >= SYNTHETIC_COMPETITION_ID_MIN;
}

export function isLegacyBolaoDefinition(def: Pick<BolaoDefinition, "competitionId" | "metadata">): boolean {
  if (isSyntheticCompetitionId(def.competitionId)) return true;
  if (def.metadata?.legacy === true) return true;
  if (def.metadata?.readOnly === true) return true;
  if (def.metadata?.system === true) return true;
  return false;
}
