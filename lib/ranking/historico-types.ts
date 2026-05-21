/** Linha de `/api/palpites/historico` usada no ranking (resultados + palpites). */
export type RankingHistoricoRow = {
  matchId: number | string;
  ticketId: string;
  bolaoType: "principal" | "diario" | "extra";
  mandante: string;
  visitante: string;
  escudoMandante: string | null;
  escudoVisitante: string | null;
  jogoData: string;
  jogoHora: string;
  palpiteCasa: number;
  palpiteVisitante: number;
  resultadoCasa: number | null;
  resultadoVisitante: number | null;
  pontos: number;
  exact: boolean;
  /** Partida em andamento (atualiza com refresh / polling). */
  aoVivo?: boolean;
  /** Ex.: "2º tempo · 38 min" — só quando `aoVivo`. */
  liveLabel?: string | null;
  matchStatus?: string | null;
  kickoffAt?: string | null;
  submittedAt: string;
  updatedAt: string;
};
