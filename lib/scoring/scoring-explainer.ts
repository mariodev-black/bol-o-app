import { calcPredictionPoints } from "@/lib/predictions/calc-points";

export type ScoringRuleExplainer = {
  title: string;
  pointsLabel: string;
  /** Texto curto abaixo do título (opcional). */
  detail?: string;
};

export const SCORING_RULES_EXPLAINER: ScoringRuleExplainer[] = [
  {
    title: "Placar exato",
    pointsLabel: "+6 pontos",
  },
  {
    title: "Vencedor + gols de 1 time",
    pointsLabel: "+4 pontos",
    detail: "Acertou o vencedor e os gols de um time.",
  },
  {
    title: "Acertou o vencedor",
    pointsLabel: "+3 pontos",
    detail: "Acertou vencedor ou empate.",
  },
  {
    title: "Gols de 1 time",
    pointsLabel: "+1 ponto",
    detail: "Acertou os gols de apenas um time.",
  },
];

export type ScoringPracticalExample = {
  id: string;
  tag: string;
  predCasa: number;
  predVisitante: number;
  realCasa: number;
  realVisitante: number;
};

export const SCORING_PRACTICAL_EXAMPLES: ScoringPracticalExample[] = [
  {
    id: "exact",
    tag: "Placar exato",
    predCasa: 2,
    predVisitante: 1,
    realCasa: 2,
    realVisitante: 1,
  },
  {
    id: "winner-plus-goal",
    tag: "Vencedor + gols de 1 time",
    predCasa: 2,
    predVisitante: 1,
    realCasa: 3,
    realVisitante: 1,
  },
  {
    id: "draw",
    tag: "Acertou o empate",
    predCasa: 1,
    predVisitante: 1,
    realCasa: 0,
    realVisitante: 0,
  },
  {
    id: "winner-only",
    tag: "Acertou o vencedor",
    predCasa: 2,
    predVisitante: 0,
    realCasa: 3,
    realVisitante: 2,
  },
  {
    id: "one-team-goal",
    tag: "Gols de 1 time",
    predCasa: 0,
    predVisitante: 1,
    realCasa: 2,
    realVisitante: 1,
  },
  {
    id: "miss",
    tag: "Sem pontos",
    predCasa: 1,
    predVisitante: 0,
    realCasa: 0,
    realVisitante: 2,
  },
];

function formatScoreLine(casa: number, visitante: number): string {
  return `${casa} × ${visitante}`;
}

function formatPointsLine(points: number): string {
  if (points <= 0) return "0 pontos";
  return points === 1 ? "+1 ponto" : `+${points} pontos`;
}

export function summarizeScoringExample(ex: ScoringPracticalExample): {
  predLabel: string;
  realLabel: string;
  points: number;
  resultLine: string;
  detail: string;
} {
  const review = calcPredictionPoints(
    ex.predCasa,
    ex.predVisitante,
    ex.realCasa,
    ex.realVisitante,
  );
  const predLabel = formatScoreLine(ex.predCasa, ex.predVisitante);
  const realLabel = formatScoreLine(ex.realCasa, ex.realVisitante);
  const resultLine = formatPointsLine(review.points);

  if (review.exact) {
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine,
      detail: "Acertou o placar completo.",
    };
  }
  if (review.outcomeHit) {
    const detail =
      review.goalsHitCount >= 1
        ? "Acertou o vencedor e os gols de um time."
        : "Acertou vencedor ou empate.";
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine,
      detail,
    };
  }
  if (review.points > 0) {
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine,
      detail:
        review.goalsHitCount >= 2
          ? "Acertou os gols dos dois times, sem o resultado."
          : "Acertou os gols de apenas um time.",
    };
  }
  return {
    predLabel,
    realLabel,
    points: 0,
    resultLine,
    detail: "Nenhuma regra de pontuação foi atingida.",
  };
}
