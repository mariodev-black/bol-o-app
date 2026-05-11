import type { StoredTicket } from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";

export type StoredPrediction = {
  ticketId: string;
  bolaoType: "principal" | "diario";
  matchId: number;
  scoreCasa: number;
  scoreVisitante: number;
  submittedAt: number;
};

const KEY = "bolao_predictions_v1";

function parse(raw: string | null): StoredPrediction[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is StoredPrediction => {
      if (!x || typeof x !== "object") return false;
      const o = x as Record<string, unknown>;
      return (
        typeof o.ticketId === "string" &&
        (o.bolaoType === "principal" || o.bolaoType === "diario") &&
        typeof o.matchId === "number" &&
        typeof o.scoreCasa === "number" &&
        typeof o.scoreVisitante === "number" &&
        typeof o.submittedAt === "number"
      );
    });
  } catch {
    return [];
  }
}

function readAll(): StoredPrediction[] {
  if (typeof window === "undefined") return [];
  return parse(localStorage.getItem(KEY));
}

function writeAll(items: StoredPrediction[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getPrediction(ticketId: string, matchId: number): StoredPrediction | null {
  const all = readAll();
  return all.find((p) => p.ticketId === ticketId && p.matchId === matchId) ?? null;
}

export function upsertPrediction(input: Omit<StoredPrediction, "submittedAt">): StoredPrediction {
  const all = readAll();
  const idx = all.findIndex((p) => p.ticketId === input.ticketId && p.matchId === input.matchId);
  const next: StoredPrediction = {
    ...input,
    submittedAt: idx >= 0 ? all[idx]!.submittedAt : Date.now(),
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeAll(all);
  return next;
}

export function listPredictionsByTicket(ticketId: string): StoredPrediction[] {
  return readAll().filter((p) => p.ticketId === ticketId);
}

export function calcPredictionPoints(
  predCasa: number,
  predVisit: number,
  realCasa: number,
  realVisit: number
): { points: number; exact: boolean; outcomeHit: boolean; goalsHitCount: number } {
  const exact = predCasa === realCasa && predVisit === realVisit;
  if (exact) {
    return { points: 6, exact: true, outcomeHit: true, goalsHitCount: 0 };
  }

  const predDiff = predCasa - predVisit;
  const realDiff = realCasa - realVisit;
  const outcomeHit = (predDiff === 0 && realDiff === 0) || (predDiff > 0 && realDiff > 0) || (predDiff < 0 && realDiff < 0);
  const goalsHitCount = (predCasa === realCasa ? 1 : 0) + (predVisit === realVisit ? 1 : 0);
  if (outcomeHit) {
    return { points: goalsHitCount > 0 ? 4 : 3, exact: false, outcomeHit: true, goalsHitCount };
  }

  return { points: goalsHitCount, exact: false, outcomeHit: false, goalsHitCount };
}

export type RankingTicketRow = {
  ticketId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  firstSubmitAt: number;
};

export function buildTicketRanking(input: {
  tickets: StoredTicket[];
  bolaoType: "principal" | "diario";
  playedMatches: Array<{ id: number; resultCasa: number; resultVisitante: number; matchDateBR?: string }>;
}): RankingTicketRow[] {
  const all = readAll().filter((p) => p.bolaoType === input.bolaoType);
  const byTicket = new Map<string, RankingTicketRow>();

  const validTicketIds = new Set(
    input.tickets
      .filter((t) => (input.bolaoType === "principal" ? t.kind === "geral" : t.kind === "diario"))
      .map((t) => t.id)
  );

  for (const p of all) {
    if (!validTicketIds.has(p.ticketId)) continue;
    const match = input.playedMatches.find((m) => m.id === p.matchId);
    if (!match) continue;
    const base =
      byTicket.get(p.ticketId) ??
      ({
        ticketId: p.ticketId,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        firstSubmitAt: p.submittedAt,
      } as RankingTicketRow);

    const calc = calcPredictionPoints(p.scoreCasa, p.scoreVisitante, match.resultCasa, match.resultVisitante);
    base.totalPoints += calc.points;
    base.exactCount += calc.exact ? 1 : 0;
    base.outcomeCount += calc.outcomeHit ? 1 : 0;
    base.goalsCount += calc.goalsHitCount;
    if (p.submittedAt < base.firstSubmitAt) base.firstSubmitAt = p.submittedAt;
    byTicket.set(p.ticketId, base);
  }

  return Array.from(byTicket.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
    if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
    return a.firstSubmitAt - b.firstSubmitAt;
  });
}

