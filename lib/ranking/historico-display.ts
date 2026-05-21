import {
  isFinishedMatchStatus,
  isLiveOrInProgressMatchStatus,
  isMatchStartedByKickoff,
} from "@/lib/palpites-match-open";

const DISPLAY_LIVE_MAX_MS_AFTER_KICKOFF = (() => {
  const raw = process.env.NEXT_PUBLIC_MATCH_DISPLAY_LIVE_MAX_MINUTES;
  const n =
    raw != null && String(raw).trim() !== ""
      ? Number.parseInt(String(raw).trim(), 10)
      : 115;
  if (!Number.isFinite(n)) return 115 * 60_000;
  return Math.min(240, Math.max(60, n)) * 60_000;
})();

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

function isPastDisplayLiveWindow(
  input: RankingHistoricoMatchInput,
  nowMs: number,
): boolean {
  const ko = kickoffMs(input.kickoffAt, input.jogoData, input.jogoHora);
  if (ko == null) return false;
  return nowMs > ko + DISPLAY_LIVE_MAX_MS_AFTER_KICKOFF;
}

/** Partida em andamento para o card de resultados do ranking. */
export function isRankingHistoricoLive(
  input: RankingHistoricoMatchInput,
  nowMs = Date.now(),
): boolean {
  const status = String(input.matchStatus ?? "");
  if (isFinishedMatchStatus(status)) return false;
  if (
    input.resultadoCasa != null &&
    input.resultadoVisitante != null &&
    isFinishedMatchStatus(status)
  ) {
    return false;
  }
  if (isPastDisplayLiveWindow(input, nowMs)) return false;
  if (isLiveOrInProgressMatchStatus(status)) return true;
  const ko = kickoffMs(input.kickoffAt, input.jogoData, input.jogoHora);
  if (ko == null || nowMs < ko) return false;
  if (isFinishedMatchStatus(status)) return false;
  const raw = status.toLowerCase();
  if (raw.includes("encerr") || raw.includes("finaliz")) return false;
  return true;
}

/** Rótulo do relógio (1º tempo · N min, Intervalo, Ao vivo). */
export function formatRankingHistoricoLiveLabel(
  input: RankingHistoricoMatchInput,
  nowMs = Date.now(),
): string {
  if (!isRankingHistoricoLive(input, nowMs)) return "Ao vivo";
  const raw = String(input.matchStatus ?? "").toLowerCase();
  if (raw.includes("intervalo")) return "Intervalo";

  const ko = kickoffMs(input.kickoffAt, input.jogoData, input.jogoHora);
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
  const live =
    row.aoVivo ??
    isRankingHistoricoLive(row, nowMs);
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
