/**
 * Preview do ranking: escudos oficiais (CDN API Futebol) e jogos da 17ª rodada
 * do Brasileirão 2026. URLs estáveis para teste visual em `/ranking?previewBoard=1`.
 */
import {
  formatRankingHistoricoLiveLabel,
  isRankingHistoricoLive,
} from "@/lib/ranking/historico-display";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";

/** Campeonato Brasileiro Série A (API-Futebol id 10). */
export const MOCK_BRASILEIRAO_CHAMPIONSHIP_ID = 10;

const E = {
  saoPaulo: "https://cdn.api-futebol.com.br/times/escudos/677fc754a5a78.svg",
  botafogo: "https://cdn.api-futebol.com.br/times/escudos/677fc743454d0.svg",
  vitoria: "https://cdn.api-futebol.com.br/times/escudos/677fc74855410.svg",
  internacional: "https://cdn.api-futebol.com.br/times/escudos/677fc74bc3190.svg",
  mirassol: "https://cdn.api-futebol.com.br/times/escudos/677fc831214bd.svg",
  fluminense: "https://cdn.api-futebol.com.br/times/escudos/677fc750c6c81.svg",
  gremio: "https://cdn.api-futebol.com.br/times/escudos/677fc735c7d91.svg",
  santos: "https://cdn.api-futebol.com.br/times/escudos/677fc82a860d4.svg",
  flamengo: "https://cdn.api-futebol.com.br/times/escudos/677fc73fcec1e.svg",
  palmeiras: "https://cdn.api-futebol.com.br/times/escudos/677fc746b0687.svg",
  cruzeiro: "https://cdn.api-futebol.com.br/times/escudos/677fc7451529e.svg",
  chapecoense: "https://cdn.api-futebol.com.br/times/escudos/677fc8287cf47.svg",
  remo: "https://cdn.api-futebol.com.br/times/escudos/677fc7625e677.svg",
  athletico: "https://cdn.api-futebol.com.br/times/escudos/677fc73c0814b.svg",
  corinthians: "https://cdn.api-futebol.com.br/times/escudos/677fc7386c4ef.svg",
  atleticoMg: "https://cdn.api-futebol.com.br/times/escudos/677fc73a35795.svg",
  vasco: "https://cdn.api-futebol.com.br/times/escudos/677fc702ef04f.svg",
  bragantino: "https://cdn.api-futebol.com.br/times/escudos/677fc752d567b.svg",
} as const;

type MockFixture = Omit<
  RankingHistoricoRow,
  "ticketId" | "bolaoType" | "submittedAt" | "updatedAt"
>;

/** 9 jogos da 17ª rodada — 5 com placar, 4 aguardando (bate com pendingPalpitesCount: 4). */
const BRASILEIRAO_RODADA_17_FIXTURES: MockFixture[] = [
  {
    matchId: 27805,
    mandante: "Flamengo",
    visitante: "Palmeiras",
    escudoMandante: E.flamengo,
    escudoVisitante: E.palmeiras,
    jogoData: "23/05/2026",
    jogoHora: "21:00",
    palpiteCasa: 2,
    palpiteVisitante: 1,
    resultadoCasa: 2,
    resultadoVisitante: 1,
    pontos: 3,
    exact: true,
  },
  {
    matchId: 27808,
    mandante: "Corinthians",
    visitante: "Atlético-MG",
    escudoMandante: E.corinthians,
    escudoVisitante: E.atleticoMg,
    jogoData: "24/05/2026",
    jogoHora: "18:30",
    palpiteCasa: 1,
    palpiteVisitante: 0,
    resultadoCasa: 2,
    resultadoVisitante: 1,
    pontos: 1,
    exact: false,
  },
  {
    matchId: 27811,
    mandante: "Grêmio",
    visitante: "Santos",
    escudoMandante: E.gremio,
    escudoVisitante: E.santos,
    jogoData: "23/05/2026",
    jogoHora: "19:00",
    palpiteCasa: 0,
    palpiteVisitante: 0,
    resultadoCasa: 0,
    resultadoVisitante: 0,
    pontos: 3,
    exact: true,
  },
  {
    matchId: 27807,
    mandante: "São Paulo",
    visitante: "Botafogo",
    escudoMandante: E.saoPaulo,
    escudoVisitante: E.botafogo,
    jogoData: "23/05/2026",
    jogoHora: "17:00",
    palpiteCasa: 0,
    palpiteVisitante: 0,
    resultadoCasa: 0,
    resultadoVisitante: 0,
    pontos: 3,
    exact: true,
    matchStatus: "ao vivo",
    aoVivo: true,
  },
  {
    matchId: 27810,
    mandante: "Cruzeiro",
    visitante: "Chapecoense",
    escudoMandante: E.cruzeiro,
    escudoVisitante: E.chapecoense,
    jogoData: "24/05/2026",
    jogoHora: "16:00",
    palpiteCasa: 1,
    palpiteVisitante: 1,
    resultadoCasa: 1,
    resultadoVisitante: 1,
    pontos: 1,
    exact: false,
  },
  {
    matchId: 27809,
    mandante: "Mirassol",
    visitante: "Fluminense",
    escudoMandante: E.mirassol,
    escudoVisitante: E.fluminense,
    jogoData: "23/05/2026",
    jogoHora: "19:00",
    palpiteCasa: 1,
    palpiteVisitante: 1,
    resultadoCasa: 1,
    resultadoVisitante: 0,
    pontos: 1,
    exact: false,
    matchStatus: "ao vivo",
    aoVivo: true,
  },
  {
    matchId: 27813,
    mandante: "Vitória",
    visitante: "Internacional",
    escudoMandante: E.vitoria,
    escudoVisitante: E.internacional,
    jogoData: "23/05/2026",
    jogoHora: "17:00",
    palpiteCasa: 0,
    palpiteVisitante: 1,
    resultadoCasa: null,
    resultadoVisitante: null,
    pontos: 0,
    exact: false,
  },
  {
    matchId: 27806,
    mandante: "Vasco",
    visitante: "Bragantino",
    escudoMandante: E.vasco,
    escudoVisitante: E.bragantino,
    jogoData: "24/05/2026",
    jogoHora: "20:30",
    palpiteCasa: 2,
    palpiteVisitante: 0,
    resultadoCasa: null,
    resultadoVisitante: null,
    pontos: 0,
    exact: false,
  },
  {
    matchId: 27814,
    mandante: "Remo",
    visitante: "Athletico-PR",
    escudoMandante: E.remo,
    escudoVisitante: E.athletico,
    jogoData: "24/05/2026",
    jogoHora: "16:00",
    palpiteCasa: 1,
    palpiteVisitante: 2,
    resultadoCasa: null,
    resultadoVisitante: null,
    pontos: 0,
    exact: false,
  },
];

export function buildMockBrasileiraoHistorico(ticketId: string): RankingHistoricoRow[] {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  return BRASILEIRAO_RODADA_17_FIXTURES.map((row) => {
    const input = {
      matchStatus: row.matchStatus ?? null,
      kickoffAt: row.kickoffAt ?? null,
      jogoData: row.jogoData,
      jogoHora: row.jogoHora,
      resultadoCasa: row.resultadoCasa,
      resultadoVisitante: row.resultadoVisitante,
    };
    const aoVivo = row.aoVivo ?? isRankingHistoricoLive(input, nowMs);
    return {
      ...row,
      ticketId,
      bolaoType: "extra",
      aoVivo,
      liveLabel: aoVivo ? formatRankingHistoricoLiveLabel(input, nowMs) : null,
      submittedAt: now,
      updatedAt: now,
    };
  });
}

export const MOCK_BRASILEIRAO_ROUND_LABEL = "17ª Rodada";
