import {
  isRankingHistoricoLive as isRankingHistoricoLiveBase,
  kickoffMsFromMatch,
  matchStatusRaw,
} from "@/lib/palpites-live-display";

export type RankingHistoricoMatchInput = {
  matchStatus?: string | null;
  kickoffAt?: string | null;
  jogoData?: string;
  jogoHora?: string;
  resultadoCasa?: number | null;
  resultadoVisitante?: number | null;
};

function kickoffMs(
  kickoffAt: string | null | undefined,
  jogoData?: string,
  jogoHora?: string,
): number | null {
  if (kickoffAt) {
    const ms = new Date(kickoffAt).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  const date = jogoData?.trim();
  if (!date) return null;
  const [d, m, y] = date.split("/");
  const [hh, mm] = (jogoHora || "00:00").split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

function toLiveDisplayInput(
  input: RankingHistoricoMatchInput,
): Parameters<typeof isRankingHistoricoLiveBase>[0] {
  return {
    status: input.matchStatus,
    statusBruto: input.matchStatus,
    kickoffAt:
      input.kickoffAt ??
      (input.jogoData && input.jogoHora
        ? `${input.jogoData} ${input.jogoHora}`
        : null),
    resultCasa: input.resultadoCasa,
    resultVisitante: input.resultadoVisitante,
    jogoData: input.jogoData,
    jogoHora: input.jogoHora,
  };
}

/** Partida em andamento para o card de resultados do ranking. */
export function isRankingHistoricoLive(
  input: RankingHistoricoMatchInput,
  nowMs = Date.now(),
): boolean {
  return isRankingHistoricoLiveBase(toLiveDisplayInput(input), nowMs);
}

/** Rótulo do relógio (1º tempo · N min, Intervalo, Ao vivo). */
export function formatRankingHistoricoLiveLabel(
  input: RankingHistoricoMatchInput,
  nowMs = Date.now(),
): string {
  if (!isRankingHistoricoLive(input, nowMs)) return "Ao vivo";
  const raw = matchStatusRaw(toLiveDisplayInput(input)).toLowerCase();
  if (raw.includes("intervalo")) return "Intervalo";

  const ko =
    kickoffMsFromMatch(toLiveDisplayInput(input)) ??
    kickoffMs(input.kickoffAt, input.jogoData, input.jogoHora);
  if (ko == null) return "Ao vivo";
  const wall = Math.max(0, Math.floor((nowMs - ko) / 60_000));
  if (wall <= 52) {
    const min = Math.min(wall, 50);
    return min <= 1 ? "1º tempo, 1 minuto" : `1º tempo, ${min} minutos`;
  }
  if (wall < 62) return "Intervalo do jogo";
  const min = Math.min(wall - 61, 99);
  return min <= 1 ? "2º tempo, 1 minuto" : `2º tempo, ${min} minutos`;
}

export function rankingHistoricoOutcomeLabel(
  row: RankingHistoricoMatchInput & {
    aoVivo?: boolean;
    exact?: boolean;
    pontos?: number;
  },
  nowMs = Date.now(),
): string {
  const live = row.aoVivo ?? isRankingHistoricoLive(row, nowMs);
  if (live) return "Jogo acontecendo agora";
  const scored = row.resultadoCasa != null && row.resultadoVisitante != null;
  if (!scored) return "Jogo ainda não começou";
  if (row.exact) return "Você acertou o placar";
  const pts = row.pontos ?? 0;
  if (pts > 0) return pts === 1 ? "Você fez 1 ponto" : `Você fez ${pts} pontos`;
  return "Nenhum ponto neste jogo";
}

/** Texto curto para o placar ao vivo (ex.: "2 a 1"). */
export function formatScorePair(home: number, away: number): string {
  return `${home} a ${away}`;
}
