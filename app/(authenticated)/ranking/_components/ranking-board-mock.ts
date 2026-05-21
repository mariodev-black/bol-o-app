import {
  buildMockBrasileiraoHistorico,
  MOCK_BRASILEIRAO_CHAMPIONSHIP_ID,
  MOCK_BRASILEIRAO_ROUND_LABEL,
} from "@/app/(authenticated)/ranking/_components/ranking-mock-brasileirao";
import type { RankingBoardMeta, RankingBoardRow } from "@/lib/ranking/board-types";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";
import type { RankingScopeOption } from "@/lib/ranking/scopes-shared";

export type MockRankingPayload = {
  rows: RankingBoardRow[];
  meta: RankingBoardMeta;
  stats: {
    palpites: number;
    acertos: number;
    pontos: number;
    exatos: number;
  };
  historico: RankingHistoricoRow[];
};

const MOCK_NAMES = [
  "Renato Rezende",
  "Ana Paula",
  "Carlos M.",
  "Juliana",
  "Marcos Silva",
  "Patrícia",
  "Roberto",
  "Fernanda",
  "Diego",
  "Você",
  "Camila",
  "Lucas",
] as const;

/** Dados fictícios para revisar o step 2 (classificação com palpites). */
export function buildMockRankingBoard(
  scope?: RankingScopeOption | null,
): MockRankingPayload {
  const ticketBase = scope?.ticketId ?? "preview-ticket-001";
  const rows: RankingBoardRow[] = MOCK_NAMES.map((name, i) => {
    const pos = i + 1;
    const isMe = name === "Você";
    return {
      pos,
      ticketId: isMe ? ticketBase : `mock-ticket-${pos}`,
      userId: isMe ? "mock-user-me" : `mock-user-${pos}`,
      displayName: name,
      totalPoints: Math.max(4, 44 - pos * 3 + (pos === 1 ? 2 : 0)),
      exactCount: Math.max(0, 3 - Math.floor(pos / 4)),
      outcomeCount: Math.max(1, 9 - Math.floor(pos / 2)),
      goalsCount: 0,
      bestStreak: 0,
      avatarIndex: pos % 6,
      avatarUploadFilename: null,
      isMe,
    };
  });

  const lockMs = Date.now() + 70 * 60 * 60 * 1000;
  const historico = buildMockRankingHistorico(ticketBase);

  return {
    rows,
    historico,
    meta: {
      participantCount: 1284,
      revenueCents: 128_400_00,
      poolCentsApprox: 600_000,
      nextPalpiteLockMs: lockMs,
      approxPremiados: 128,
      hasResultedMatchesInPool: true,
    },
    stats: {
      palpites: 9,
      acertos: 5,
      pontos: 18,
      exatos: 1,
    },
  };
}

/** Partidas de preview — Brasileirão 17ª rodada com escudos reais (CDN). */
export function buildMockRankingHistorico(ticketId: string): RankingHistoricoRow[] {
  return buildMockBrasileiraoHistorico(ticketId);
}

/** Escopo fictício quando ainda não há cotas reais no bootstrap. */
export function buildMockScopeOption(): RankingScopeOption {
  return {
    key: "extra:preview",
    mode: "extra",
    ticketId: "preview-ticket-001",
    label: `Brasileirão — ${MOCK_BRASILEIRAO_ROUND_LABEL}`,
    meta: "Cota PREVIEW",
    selectPrimary: `Brasileirão · ${MOCK_BRASILEIRAO_ROUND_LABEL}`,
    selectSecondary: "23/05/2026 · #1",
    extraChampionshipId: MOCK_BRASILEIRAO_CHAMPIONSHIP_ID,
    status: "aguardando",
    statusLabel: "Aguardando seus palpites",
    unusedPalpites: true,
    pendingPalpitesCount: 5,
    palpitesSentCount: 0,
    roundLabel: MOCK_BRASILEIRAO_ROUND_LABEL,
    palpitesHref: "/palpites?ticket=preview-ticket-001",
  };
}
