/**
 * Campeonatos exibidos no grid "Outros bolões" da home (/boloes).
 * Ordem fixa (branding): Copa do Mundo 2026 → Brasileirão → Premier League.
 */

import { getCopaChampionshipId, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { getSkaleBolaoCompetitionId } from "@/lib/boloes/skale-config";

export { getCopaChampionshipId } from "@/lib/boloes-extra-config";

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

export function getBrasileiraoChampionshipId(): number {
  return parseIdList(env("BRASILEIRAO_EXTRA_CHAMPIONSHIP_IDS"), [10])[0]!;
}

export function getPremierChampionshipId(): number {
  return parseIdList(env("PREMIER_LEAGUE_EXTRA_CHAMPIONSHIP_IDS"), [69])[0]!;
}

export function getChampionsChampionshipId(): number {
  return parseIdList(env("CHAMPIONS_LEAGUE_EXTRA_CHAMPIONSHIP_IDS"), [20])[0]!;
}

export type OutrosBolaoGridItem = {
  championshipId: number;
  label: string;
  participants: number;
};

export type OutrosBolaoLogoKey = "copa2026" | "brasileirao" | "premier" | "champions";

export type OutrosBolaoItemDef = {
  championshipId: number;
  label: string;
  logoKey: OutrosBolaoLogoKey;
};

/** Definições fixas dos itens do grid (ordem = ordem de exibição). */
export const OUTROS_BOLAO_ITEM_DEFS: readonly OutrosBolaoItemDef[] = [
  { championshipId: getCopaChampionshipId(), label: "COPA DO MUNDO", logoKey: "copa2026" },
  { championshipId: getBrasileiraoChampionshipId(), label: "BRASILEIRÃO", logoKey: "brasileirao" },
  { championshipId: getPremierChampionshipId(), label: "PREMIER LEAGUE", logoKey: "premier" },
  { championshipId: getChampionsChampionshipId(), label: "CHAMPIONS LEAGUE", logoKey: "champions" },
  { championshipId: getSkaleBolaoCompetitionId(), label: "COPA SÁB/DOM", logoKey: "copa2026" },
] as const;

/** Participantes fake por campeonato (chave = championshipId). */
export const OUTROS_BOLAO_FAKE_PARTICIPANTS: Record<number, number> = {
  [getCopaChampionshipId()]: 720,
  [getBrasileiraoChampionshipId()]: 640,
  [getPremierChampionshipId()]: 360,
  [getChampionsChampionshipId()]: 480,
  [getSkaleBolaoCompetitionId()]: 540,
};

function resolveOutrosBolaoParticipants(
  championshipId: number,
  participantsByChampionship: Record<number, number>,
): number {
  const real = participantsByChampionship[championshipId];
  if (real != null && real > 0) return real;
  return OUTROS_BOLAO_FAKE_PARTICIPANTS[championshipId] ?? 0;
}

export function getOutrosBoloesGridItems(
  participantsByChampionship: Record<number, number> = {},
): OutrosBolaoGridItem[] {
  const activeExtraIds = new Set(parseExtraBolaoChampionshipIds());
  return OUTROS_BOLAO_ITEM_DEFS.filter((def) => activeExtraIds.has(def.championshipId)).map(
    (def) => ({
      championshipId: def.championshipId,
      label: def.label,
      participants: resolveOutrosBolaoParticipants(def.championshipId, participantsByChampionship),
    }),
  );
}

/** IDs na ordem de exibição do grid (Copa primeiro). */
export function getOutrosBoloesChampionshipIds(): number[] {
  return OUTROS_BOLAO_ITEM_DEFS.map((d) => d.championshipId);
}

export function getOutrosBolaoItemDefByChampionshipId(
  championshipId: number,
): OutrosBolaoItemDef | undefined {
  return OUTROS_BOLAO_ITEM_DEFS.find((d) => d.championshipId === championshipId);
}

/** Resolve o item do grid pelo championshipId; fallback para Brasileirão. */
export function resolveOutrosBolaoGridItem(
  championshipId: number,
): OutrosBolaoGridItem | undefined {
  const def = getOutrosBolaoItemDefByChampionshipId(championshipId);
  if (!def) return undefined;
  return {
    championshipId: def.championshipId,
    label: def.label,
    participants: resolveOutrosBolaoParticipants(def.championshipId, {}),
  };
}
