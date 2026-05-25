import type { MatchMapEntry } from "@/lib/football-api";
import {
  isFinishedMatchStatus,
  isLiveOrInProgressMatchStatus,
} from "@/lib/palpites-match-open";

export type BolaoDisplayPhase = "pendentes" | "enviados" | "disputa" | "finalizado";

export type BolaoDisplayStatusMeta = {
  phase: BolaoDisplayPhase;
  label: string;
  shortLabel: string;
  tone: string;
};

const META: Record<BolaoDisplayPhase, Omit<BolaoDisplayStatusMeta, "phase">> = {
  pendentes: {
    label: "Palpites pendentes",
    shortLabel: "PALPITES PENDENTES",
    tone: "#EAB308",
  },
  enviados: {
    label: "Palpites enviados",
    shortLabel: "PALPITES ENVIADOS",
    tone: "#4ADE80",
  },
  disputa: {
    label: "Em disputa",
    shortLabel: "EM DISPUTA",
    tone: "#B1EB0B",
  },
  finalizado: {
    label: "Finalizado",
    shortLabel: "FINALIZADO",
    tone: "#FCD34D",
  },
};

export type BolaoMatchPhaseInput = Pick<
  MatchMapEntry,
  "status" | "resultCasa" | "resultVisitante" | "kickoffAt" | "dateBR" | "hour"
>;

export function bolaoDisplayStatusMeta(phase: BolaoDisplayPhase): BolaoDisplayStatusMeta {
  return { phase, ...META[phase] };
}

/** Texto do badge na vitrine de bolões (rótulo em caixa alta, sem emoji). */
export function bolaoDisplayBadgeText(phase: BolaoDisplayPhase): string {
  return bolaoDisplayStatusMeta(phase).shortLabel;
}

function matchEndClockMs(): number {
  const raw =
    (typeof process !== "undefined"
      ? process.env.MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES
      : undefined) ??
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES
      : undefined) ??
    "115";
  const n = Number.parseInt(String(raw).trim(), 10);
  const minutes = Number.isFinite(n) ? Math.min(300, Math.max(45, n)) : 115;
  return minutes * 60_000;
}

/**
 * Partida encerrada para fase do bolão.
 * Não usa placar sozinho antes do apito nem antes da janela pós-jogo.
 */
export function isBolaoMatchFinished(
  match: BolaoMatchPhaseInput,
  nowMs = Date.now(),
): boolean {
  const status = String(match.status ?? "");
  if (isFinishedMatchStatus(status)) return true;

  if (isLiveOrInProgressMatchStatus(status)) return false;

  const kickoff = bolaoMatchKickoffMs(match);
  if (kickoff == null) {
    const dayClose = match.dateBR
      ? bolaoMatchKickoffMs({
          dateBR: match.dateBR,
          hour: match.hour ?? "23:59",
          kickoffAt: match.kickoffAt,
        })
      : null;
    if (dayClose != null && nowMs >= dayClose + matchEndClockMs()) {
      return !isLiveOrInProgressMatchStatus(status);
    }
    return false;
  }
  if (nowMs < kickoff) return false;

  if (nowMs >= kickoff + matchEndClockMs()) {
    return true;
  }

  return false;
}

export function bolaoMatchKickoffMs(
  match: Pick<MatchMapEntry, "kickoffAt" | "dateBR" | "hour">,
): number | null {
  if (match.kickoffAt) {
    const parsed = Date.parse(match.kickoffAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (!match.dateBR || !match.hour) return null;
  const [d, m, y] = match.dateBR.split("/");
  const [hh, mm] = match.hour.split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

/**
 * Bolão/rodada só finaliza quando **todos** os jogos do escopo acabaram
 * (inclui partidas futuras ainda agendadas na rodada).
 */
export function isBolaoScopeRoundComplete(
  scope: BolaoMatchPhaseInput[],
  nowMs = Date.now(),
): boolean {
  if (scope.length === 0) return false;

  for (const m of scope) {
    const status = String(m.status ?? "");
    if (isLiveOrInProgressMatchStatus(status)) return false;

    const kickoff = bolaoMatchKickoffMs(m);
    if (
      kickoff != null &&
      kickoff > nowMs &&
      !isFinishedMatchStatus(status) &&
      !isBolaoMatchFinished(m, nowMs)
    ) {
      return false;
    }

    if (!isBolaoMatchFinished(m, nowMs)) return false;
  }

  return true;
}

/**
 * Fluxo ideal do bolão na vitrine:
 * 1. Palpites pendentes → 2. Palpites enviados → 3. Em disputa → 4. Finalizado
 */
export function computeBolaoDisplayPhase(input: {
  sent: number;
  total: number;
  available: number;
  scopeMatches: BolaoMatchPhaseInput[];
  /** Partidas em que o usuário já palpitou (cota sem jogos em aberto). */
  predictionScopeMatches?: BolaoMatchPhaseInput[];
  dailyStatus?: "disponivel" | "em_uso" | "usado" | null;
  now?: number;
}): BolaoDisplayPhase {
  const now = input.now ?? Date.now();
  const scope = input.scopeMatches;
  const predScope = input.predictionScopeMatches ?? [];

  if (input.dailyStatus === "usado") {
    return "finalizado";
  }

  if (isBolaoScopeRoundComplete(scope, now)) {
    return "finalizado";
  }

  if (
    input.sent > 0 &&
    input.available === 0 &&
    predScope.length > 0 &&
    isBolaoScopeRoundComplete(predScope, now)
  ) {
    return "finalizado";
  }

  const anyInPlay = scope.some((m) => {
    if (isBolaoMatchFinished(m, now)) return false;
    const status = String(m.status ?? "");
    if (isLiveOrInProgressMatchStatus(status)) return true;
    const kickoff = bolaoMatchKickoffMs(m);
    return kickoff != null && kickoff <= now;
  });

  if (anyInPlay) {
    return "disputa";
  }

  const pendingPalpites =
    input.available > 0 || (input.total > 0 && input.sent < input.total);

  if (!pendingPalpites) {
    return "enviados";
  }

  return "pendentes";
}

/** Ordenação da vitrine: quem ainda pode palpitar primeiro; finalizado por último. */
export function bolaoDisplayPhaseSortRank(phase: BolaoDisplayPhase): number {
  if (phase === "pendentes") return 0;
  if (phase === "enviados") return 1;
  if (phase === "disputa") return 2;
  return 3;
}
