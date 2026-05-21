/** Fórmula de pontuação por jogo — sem dependências de Node/DB (seguro no client). */
export function calcPredictionPoints(
  predCasa: number,
  predVisit: number,
  realCasa: number,
  realVisit: number,
): {
  points: number;
  exact: boolean;
  outcomeHit: boolean;
  goalsHitCount: number;
} {
  const exact = predCasa === realCasa && predVisit === realVisit;
  if (exact) {
    return { points: 6, exact: true, outcomeHit: true, goalsHitCount: 0 };
  }
  const predDiff = predCasa - predVisit;
  const realDiff = realCasa - realVisit;
  const outcomeHit =
    (predDiff === 0 && realDiff === 0) ||
    (predDiff > 0 && realDiff > 0) ||
    (predDiff < 0 && realDiff < 0);
  const goalsHitCount =
    (predCasa === realCasa ? 1 : 0) + (predVisit === realVisit ? 1 : 0);
  if (outcomeHit) {
    return {
      points: goalsHitCount > 0 ? 4 : 3,
      exact: false,
      outcomeHit: true,
      goalsHitCount,
    };
  }
  return {
    points: goalsHitCount,
    exact: false,
    outcomeHit: false,
    goalsHitCount,
  };
}
