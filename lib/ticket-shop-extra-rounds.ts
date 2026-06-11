import { resolveCurrentExtraRound } from "@/lib/football/extras-rodada";

export type ExtraBolaoRoundInfo = {
  roundNumber: number;
  roundLabel: string;
};

/** Rodada atual por campeonato extra (cache/API-Futebol). */
export async function extraBolaoCurrentRoundsByChampionship(
  championshipIds: number[],
): Promise<Record<number, ExtraBolaoRoundInfo>> {
  const ids = [...new Set(championshipIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return {};

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
