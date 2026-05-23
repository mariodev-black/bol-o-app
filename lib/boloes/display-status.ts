import type { MatchMapEntry } from "@/lib/football-api";

export type BolaoDisplayPhase = "pendentes" | "enviados" | "disputa" | "finalizado";

export type BolaoDisplayStatusMeta = {
  phase: BolaoDisplayPhase;
  label: string;
  shortLabel: string;
  emoji: string;
  tone: string;
};

const META: Record<BolaoDisplayPhase, Omit<BolaoDisplayStatusMeta, "phase">> = {
  pendentes: {
    label: "Palpites pendentes",
    shortLabel: "Palpites pendentes",
    emoji: "🟡",
    tone: "#EAB308",
  },
  enviados: {
    label: "Palpites enviados",
    shortLabel: "Palpites enviados",
    emoji: "🟢",
    tone: "#4ADE80",
  },
  disputa: {
    label: "Em disputa",
    shortLabel: "Em disputa",
    emoji: "🔥",
    tone: "#B1EB0B",
  },
  finalizado: {
    label: "Finalizado",
    shortLabel: "Finalizado",
    emoji: "🏆",
    tone: "#FCD34D",
  },
};

export function bolaoDisplayStatusMeta(phase: BolaoDisplayPhase): BolaoDisplayStatusMeta {
  return { phase, ...META[phase] };
}

export function isBolaoMatchFinished(match: Pick<MatchMapEntry, "status" | "resultCasa" | "resultVisitante">): boolean {
  const s = String(match.status ?? "").toLowerCase();
  if (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  ) {
    return true;
  }
  return match.resultCasa != null && match.resultVisitante != null;
}

export function bolaoMatchKickoffMs(match: Pick<MatchMapEntry, "kickoffAt" | "dateBR" | "hour">): number | null {
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
 * Fluxo ideal do bolão na vitrine:
 * 1. Palpites pendentes → 2. Palpites enviados → 3. Em disputa → 4. Finalizado
 */
export function computeBolaoDisplayPhase(input: {
  sent: number;
  total: number;
  available: number;
  scopeMatches: Array<Pick<MatchMapEntry, "status" | "resultCasa" | "resultVisitante" | "kickoffAt" | "dateBR" | "hour">>;
  dailyStatus?: "disponivel" | "em_uso" | "usado" | null;
  now?: number;
}): BolaoDisplayPhase {
  const now = input.now ?? Date.now();
  const scope = input.scopeMatches;
  const allFinished =
    scope.length > 0 && scope.every((m) => isBolaoMatchFinished(m));

  if (input.dailyStatus === "usado" || allFinished) {
    return "finalizado";
  }

  const anyInPlay = scope.some((m) => {
    if (isBolaoMatchFinished(m)) return false;
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
