import { calcPredictionPoints } from "@/lib/predictions/calc-points";

export type ScoringRuleExplainer = {
  title: string;
  subtitle?: string;
  pointsLabel: string;
};

export const SCORING_RULES_EXPLAINER: ScoringRuleExplainer[] = [
  {
    title: "Placar exato",
    pointsLabel: "6 pts",
  },
  {
    title: "Vencedor + gol de um time",
    subtitle: "sem placar exato",
    pointsLabel: "4 pts",
  },
  {
    title: "Acertar vencedor ou empate",
    subtitle: "sem placar exato",
    pointsLabel: "3 pts",
  },
  {
    title: "Gols de um time",
    subtitle: "sem acertar o resultado",
    pointsLabel: "1 pt / time",
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
    tag: "Vencedor + 1 gol",
    predCasa: 2,
    predVisitante: 0,
    realCasa: 3,
    realVisitante: 1,
  },
  {
    id: "winner-only",
    tag: "Só o resultado",
    predCasa: 1,
    predVisitante: 1,
    realCasa: 0,
    realVisitante: 0,
  },
  {
    id: "one-team-goal",
    tag: "Gol de um time",
    predCasa: 0,
    predVisitante: 2,
    realCasa: 1,
    realVisitante: 2,
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

  if (review.exact) {
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine: `+${review.points} pontos · placar exato`,
      detail: "Você acertou quantos gols cada time fez.",
    };
  }
  if (review.outcomeHit) {
    const detail =
      review.goalsHitCount >= 1
        ? "Acertou quem venceu (ou empate) e também um dos números do placar."
        : "Acertou quem venceu ou se o jogo terminou empatado.";
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine: `+${review.points} pontos · resultado certo`,
      detail,
    };
  }
  if (review.points > 0) {
    return {
      predLabel,
      realLabel,
      points: review.points,
      resultLine: `+${review.points} ponto${review.points > 1 ? "s" : ""} · gol de um time`,
      detail: "Sem acertar o resultado, mas um dos gols de um time bateu.",
    };
  }
  return {
    predLabel,
    realLabel,
    points: 0,
    resultLine: "0 pontos",
    detail: "Palpite e placar final não coincidem nas regras acima.",
  };
}
