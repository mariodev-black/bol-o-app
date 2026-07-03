import { unstable_cache } from "next/cache";
import { resolveCurrentExtraRound } from "@/lib/football/extras-rodada";

export type ExtraBolaoRoundInfo = {
  roundNumber: number;
  roundLabel: string;
};

/** Não varia por usuário — mesmo cache pra todo mundo. */
const EXTRA_ROUNDS_REVALIDATE_SEC = 15;

/** Rodada atual por campeonato extra (cache/API-Futebol). */
export async function extraBolaoCurrentRoundsByChampionship(
  championshipIds: number[],
): Promise<Record<number, ExtraBolaoRoundInfo>> {
  const ids = [...new Set(championshipIds.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  );
  if (ids.length === 0) return {};

  const getCached = unstable_cache(
    () => extraBolaoCurrentRoundsByChampionshipUncached(ids),
    ["extra-rounds", ids.join(",")],
    { revalidate: EXTRA_ROUNDS_REVALIDATE_SEC, tags: ["extra-rounds"] },
  );
  return getCached();
}

async function extraBolaoCurrentRoundsByChampionshipUncached(
  ids: number[],
): Promise<Record<number, ExtraBolaoRoundInfo>> {
  const entries = await Promise.all(
    ids.map(async (championshipId) => {
      try {
        const resolved = await resolveCurrentExtraRound(championshipId, {
          allowProviderCall: false,
        });
        if (!resolved || !Number.isFinite(resolved.rodada) || resolved.rodada <= 0) {
          return null;
        }
        const roundLabel =
          resolved.rodadaNome?.trim() || `${resolved.rodada}ª Rodada`;
        return [
          championshipId,
          { roundNumber: resolved.rodada, roundLabel },
        ] as const;
      } catch {
        return null;
      }
    }),
  );

  const out: Record<number, ExtraBolaoRoundInfo> = {};
  for (const entry of entries) {
    if (entry) out[entry[0]] = entry[1];
  }
  return out;
}
