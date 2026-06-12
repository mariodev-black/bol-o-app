import { calcPredictionPoints } from "@/lib/predictions/calc-points";
import { resolveOfficialMatchResults } from "@/lib/palpites-match-open";
import type { PredictionAggregateRow } from "@/lib/predictions";
import type { MatchMapEntry } from "@/lib/football-api";

/** Um palpite por cota+jogo — fica o envio mais recente. */
export function dedupeLatestPredictions(
  predictions: PredictionAggregateRow[],
): PredictionAggregateRow[] {
  const byKey = new Map<string, PredictionAggregateRow>();
  for (const p of predictions) {
    const key = `${p.ticket_id}:${p.match_id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
      continue;
    }
    const pAt = new Date(p.submitted_at).getTime();
    const eAt = new Date(existing.submitted_at).getTime();
    if (Number.isFinite(pAt) && (!Number.isFinite(eAt) || pAt >= eAt)) {
      byKey.set(key, p);
    }
  }
  return [...byKey.values()];
}

/** Pontua só com placar oficial (jogo encerrado) — alinhado à tela de palpites. */
export function scorePredictionAgainstMatch(
  prediction: Pick<PredictionAggregateRow, "score_casa" | "score_visitante">,
  match: Pick<
    MatchMapEntry,
    "status" | "kickoffAt" | "resultCasa" | "resultVisitante"
  >,
): ReturnType<typeof calcPredictionPoints> | null {
  const official = resolveOfficialMatchResults({
    status: match.status,
    kickoffAt: match.kickoffAt,
    resultCasa: match.resultCasa,
    resultVisitante: match.resultVisitante,
  });
  if (official.resultCasa == null || official.resultVisitante == null) {
    return null;
  }
  return calcPredictionPoints(
    prediction.score_casa,
    prediction.score_visitante,
    official.resultCasa,
    official.resultVisitante,
  );
}
