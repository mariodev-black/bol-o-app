import {
  getDailyEditionDatesSet,
  isMatchInDailyEditionScope,
  matchDisplayDateBRForDailyEdition,
} from "@/lib/boloes/daily-editions";

export function isWeekendDateBR(dateBR: string): boolean {
  const [d, m, y] = dateBR.split("/").map(Number);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return false;
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/** Só jogos da fase de grupos — exclui mata-mata (`segunda-fase`, `oitavas`, etc.). */
export function isGroupStageFaseKey(faseKey: string | null | undefined): boolean {
  return (faseKey ?? "").trim().toLowerCase() === "fase-de-grupos";
}

export type PalpitesJogosFilterContext = {
  bolaoType: "principal" | "diario" | "extra";
  isSkaleFullCopaPool?: boolean;
  isSkaleDailyEditionPool?: boolean;
  isWeekendEditionPool?: boolean;
  dailyEditionNumber?: number | null;
  extraRoundNumber?: number | null;
};

export type PalpiteJogoFilterable = {
  dataBR: string;
  hora: string;
  kickoffAt: string | null;
  rodada: number;
  faseKey?: string | null;
};

export function isPrincipalOrSkaleFullCopa(ctx: PalpitesJogosFilterContext): boolean {
  return ctx.bolaoType === "principal" || ctx.isSkaleFullCopaPool === true;
}

export function isOfficialDailyBolao(ctx: PalpitesJogosFilterContext): boolean {
  return ctx.bolaoType === "diario" && ctx.dailyEditionNumber != null;
}

/** Data exibida nas abas Hoje/Amanhã (madrugada no último dia da edição só no diário oficial). */
export function matchDisplayDateBRForPalpites(
  match: Pick<PalpiteJogoFilterable, "dataBR" | "hora" | "kickoffAt">,
  ctx: PalpitesJogosFilterContext,
): string {
  if (isOfficialDailyBolao(ctx)) {
    return matchDisplayDateBRForDailyEdition(
      { dateBR: match.dataBR, hour: match.hora, kickoffAt: match.kickoffAt },
      ctx.dailyEditionNumber!,
    );
  }
  return match.dataBR;
}

export function filterPalpitesJogos<T extends PalpiteJogoFilterable>(
  jogos: T[],
  ctx: PalpitesJogosFilterContext,
): T[] {
  if (isPrincipalOrSkaleFullCopa(ctx)) {
    return jogos;
  }

  if (ctx.isWeekendEditionPool) {
    return jogos.filter((j) => j.dataBR != null && isWeekendDateBR(j.dataBR));
  }

  if (
    ctx.bolaoType === "extra" &&
    !ctx.isSkaleDailyEditionPool &&
    !ctx.isWeekendEditionPool &&
    ctx.extraRoundNumber != null &&
    ctx.extraRoundNumber > 0
  ) {
    return jogos.filter((j) => j.rodada === ctx.extraRoundNumber);
  }

  if (isOfficialDailyBolao(ctx)) {
    return jogos.filter(
      (j) =>
        isGroupStageFaseKey(j.faseKey) &&
        isMatchInDailyEditionScope(
          { dateBR: j.dataBR, hour: j.hora, kickoffAt: j.kickoffAt },
          ctx.dailyEditionNumber!,
        ),
    );
  }

  if (ctx.isSkaleDailyEditionPool && ctx.dailyEditionNumber != null) {
    const dates = getDailyEditionDatesSet(ctx.dailyEditionNumber);
    return jogos.filter(
      (j) =>
        isGroupStageFaseKey(j.faseKey) &&
        j.dataBR != null &&
        dates.has(j.dataBR),
    );
  }

  return jogos;
}

export function palpitesFilterFromInitialData(data: {
  bolaoType: "principal" | "diario" | "extra";
  isSkaleFullCopaPool?: boolean;
  isSkaleDailyEditionPool?: boolean;
  isWeekendEditionPool?: boolean;
  dailyEditionNumber?: number | null;
  extraRoundNumber?: number | null;
}): PalpitesJogosFilterContext {
  return {
    bolaoType: data.bolaoType,
    isSkaleFullCopaPool: data.isSkaleFullCopaPool === true,
    isSkaleDailyEditionPool: data.isSkaleDailyEditionPool === true,
    isWeekendEditionPool: data.isWeekendEditionPool === true,
    dailyEditionNumber: data.dailyEditionNumber ?? null,
    extraRoundNumber: data.extraRoundNumber ?? null,
  };
}

/** Competição para GET /api/partidas no poll ao vivo. */
export function resolvePalpitesPollCompetitionId(data: {
  bolaoType: "principal" | "diario" | "extra";
  isSkaleFullCopaPool?: boolean;
  extraChampionshipId?: number | null;
}): number | null {
  if (data.bolaoType === "principal" || data.bolaoType === "diario") {
    return null;
  }
  if (data.isSkaleFullCopaPool && data.extraChampionshipId != null) {
    return data.extraChampionshipId;
  }
  if (data.bolaoType === "extra" && data.extraChampionshipId != null) {
    return data.extraChampionshipId;
  }
  return null;
}
