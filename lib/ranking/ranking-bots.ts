import type { LeaderboardRow } from "@/lib/ranking/leaderboard";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";

const BOT_USER_PREFIX = "ranking-bot:";
const BOT_TICKET_PREFIX = "ranking-bot-ticket:";
const LEGACY_FILLER_USER_PREFIX = "ranking-filler:";
const LEGACY_FILLER_TICKET_PREFIX = "ranking-filler-ticket:";

export const RANKING_TOP10_BOT_COUNT = 10;

/** Referência do bolão real para calibrar pontos e acertos dos bots. */
export type RealPoolSnapshot = {
  maxPoints: number;
  maxOutcomeCount: number;
  maxExactCount: number;
  maxGoalsCount: number;
  p75Points: number;
  /** Pontuação do 10º jogador real (referência para o último bot do top 10). */
  tenthRealPoints: number;
};

export type RankingBotPoolContext = {
  hasResultedMatches: boolean;
  estimatedGamesInPool?: number;
  finishedGamesInPool?: number;
  liveGamesInPool?: number;
  realPool?: RealPoolSnapshot;
};

function summarizeRealPool(realRows: LeaderboardRow[]): RealPoolSnapshot {
  if (realRows.length === 0) {
    return {
      maxPoints: 0,
      maxOutcomeCount: 0,
      maxExactCount: 0,
      maxGoalsCount: 0,
      p75Points: 0,
      tenthRealPoints: 0,
    };
  }
  const sorted = [...realRows].sort((a, b) => b.totalPoints - a.totalPoints);
  const top = sorted[0]!;
  const p75Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.25));
  const p75 = sorted[p75Idx]!;
  const tenthIdx = Math.min(9, sorted.length - 1);
  const tenth = sorted[tenthIdx]!;
  return {
    maxPoints: top.totalPoints,
    maxOutcomeCount: top.outcomeCount,
    maxExactCount: top.exactCount,
    maxGoalsCount: top.goalsCount,
    p75Points: p75.totalPoints,
    tenthRealPoints: tenth.totalPoints,
  };
}

/** Nomes completos fictícios — mistura de perfis para o top 10 simulado. */
const SIMULATED_FULL_NAMES = [
  "Carlos Eduardo Oliveira",
  "Ana Paula Rodrigues",
  "Lucas Henrique Souza",
  "Mariana Costa Alves",
  "Rafael Augusto Nascimento",
  "Juliana Ferreira Lima",
  "Bruno Gabriel Mendes",
  "Camila Ribeiro Santos",
  "Felipe Andrade Barbosa",
  "Larissa Cristina Gomes",
  "Gustavo Henrique Rezende",
  "Beatriz Aparecida Martins",
  "Diego César Pinto",
  "Fernanda Luiza Carvalho",
  "Thiago Ramos Duarte",
  "Patrícia Monteiro Freitas",
  "Rodrigo Silveira Azevedo",
  "Amanda Vitória Correia",
  "Marcos Antônio Rocha",
  "Letícia Moura Teixeira",
  "André Luiz Cavalcanti",
  "Carla Regina Dias",
  "Vinícius Almeida Borges",
  "Renata Siqueira Melo",
  "Paulo Sérgio Farias",
  "Aline Cristiane Nunes",
  "Henrique Augusto Lopes",
  "Natália Borges Cardoso",
  "Leandro Matos Pereira",
  "Bianca Helena Castro",
  "Fábio José Aragão",
  "Débora Cristina Machado",
  "Caio Vinícius Peixoto",
  "Priscila Oliveira Campos",
  "Igor Felipe Santana",
  "Tatiane Souza Ribeiro",
  "Mateus Lima Fernandes",
  "Vanessa Cristina Barros",
  "Eduardo Batista Nonato",
  "Francisco Eduardo Gomes",
] as const;

function parseEnvBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return defaultValue;
}

export function rankingBotsEnabled(): boolean {
  return parseEnvBool(process.env.RANKING_BOTS_ENABLED, true);
}

export function rankingMinDisplayParticipants(): number {
  const n = Number.parseInt(
    (process.env.RANKING_MIN_DISPLAY_PARTICIPANTS || "24").trim(),
    10,
  );
  if (!Number.isFinite(n)) return 24;
  return Math.min(80, Math.max(8, n));
}

export function isRankingFillerRow(row: {
  userId?: string;
  ticketId?: string;
  isFiller?: boolean;
}): boolean {
  if (row.isFiller === true) return true;
  const uid = String(row.userId ?? "");
  const tid = String(row.ticketId ?? "");
  return (
    uid.startsWith(BOT_USER_PREFIX) ||
    uid.startsWith(LEGACY_FILLER_USER_PREFIX) ||
    tid.startsWith(BOT_TICKET_PREFIX) ||
    tid.startsWith(LEGACY_FILLER_TICKET_PREFIX)
  );
}

export function isRankingBotUserId(userId: string): boolean {
  return isRankingFillerRow({ userId });
}

export function isRankingBotTicketId(ticketId: string): boolean {
  return isRankingFillerRow({ ticketId });
}

/** Avatares dos bots usam apenas preset (`avatarIndex`). */
export function rankingFillerAvatarUserId(userId: string): string {
  return String(userId);
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(poolKey: string, botIndex: number, salt: number): number {
  const h = hashString(`${poolKey}|${botIndex}|${salt}`);
  return (h % 10_000) / 10_000;
}

export function rankingBotPoolKey(
  mode: "principal" | "diario" | "extra",
  parts: Record<string, string | number | null | undefined> = {},
): string {
  const extra = Object.entries(parts)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return extra ? `${mode}:${extra}` : mode;
}

function compareLeaderboardEntries(a: LeaderboardRow, b: LeaderboardRow): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
  if (b.outcomeCount !== b.outcomeCount) return b.outcomeCount - a.outcomeCount;
  if (b.goalsCount !== b.goalsCount) return b.goalsCount - a.goalsCount;
  if (b.bestStreak !== b.bestStreak) return b.bestStreak - a.bestStreak;
  const aFiller = isRankingFillerRow(a);
  const bFiller = isRankingFillerRow(b);
  if (aFiller !== bFiller) return aFiller ? 1 : -1;
  return a.ticketId.localeCompare(b.ticketId);
}

/**
 * Conjunto de nomes exclusivo por bolão (`poolKey`), estável entre refreshes.
 * Principal, diário (data) e extra (comp+rodada) nunca compartilham o mesmo top 10.
 */
function shuffledBotNamesForPool(poolKey: string, count: number): string[] {
  if (count <= 0) return [];

  const indices = SIMULATED_FULL_NAMES.map((_, i) => i);
  indices.sort((a, b) => {
    const ha = hashString(`${poolKey}|nome|${a}`);
    const hb = hashString(`${poolKey}|nome|${b}`);
    return ha - hb;
  });

  const names: string[] = [];
  for (const idx of indices) {
    names.push(SIMULATED_FULL_NAMES[idx]!);
    if (names.length >= count) break;
  }
  return names;
}

/** 0 = rodada não começou; 1 = todos os jogos encerrados (com peso ao vivo no meio). */
function poolScoringProgress(ctx: RankingBotPoolContext): number {
  const total = Math.max(1, ctx.estimatedGamesInPool ?? 10);
  const finished = Math.max(0, ctx.finishedGamesInPool ?? 0);
  const live = Math.max(0, ctx.liveGamesInPool ?? 0);
  const liveWeight = 0.45;
  return Math.min(1, (finished + live * liveWeight) / total);
}

/**
 * Decompõe pontos como no bolão (6 exato, 3–4 resultado, 1–2 gols).
 * Mantém acertos coerentes com a pontuação e com o líder real.
 */
function statsFromPoints(
  poolKey: string,
  botIndex: number,
  totalPoints: number,
  games: number,
  realPool?: RealPoolSnapshot,
): Pick<
  LeaderboardRow,
  "totalPoints" | "exactCount" | "outcomeCount" | "goalsCount" | "bestStreak"
> {
  if (totalPoints <= 0) {
    return {
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      goalsCount: 0,
      bestStreak: 0,
    };
  }

  let rem = totalPoints;
  let exactCount = 0;
  while (rem >= 6 && exactCount < games) {
    exactCount += 1;
    rem -= 6;
  }

  let partialHits = 0;
  while (rem >= 3 && exactCount + partialHits < games) {
    const chunk =
      rem >= 4 && seededUnit(poolKey, botIndex, 25) > 0.38 ? 4 : 3;
    if (rem < chunk) break;
    rem -= chunk;
    partialHits += 1;
  }

  let outcomeCount = exactCount + partialHits;
  if (rem > 0 && outcomeCount < games) {
    outcomeCount += 1;
    rem = 0;
  }

  let goalsCount = outcomeCount + (rem > 0 ? 1 : 0);
  goalsCount = Math.min(games + 2, Math.max(outcomeCount, goalsCount));

  if (realPool && realPool.maxPoints > 0) {
    const ratio = Math.min(1.15, totalPoints / realPool.maxPoints);
    const maxOutcome = Math.min(
      games,
      Math.max(exactCount, Math.ceil(realPool.maxOutcomeCount * ratio)),
    );
    const maxExact = Math.min(
      games,
      Math.max(0, Math.ceil(realPool.maxExactCount * ratio)),
    );
    exactCount = Math.min(exactCount, maxExact);
    outcomeCount = Math.min(Math.max(exactCount, outcomeCount), maxOutcome);
    goalsCount = Math.min(
      Math.max(outcomeCount, realPool.maxGoalsCount),
      Math.max(goalsCount, outcomeCount),
    );
  }

  const bestStreak = Math.min(
    outcomeCount,
    Math.max(
      exactCount > 0 ? 1 : 0,
      Math.floor(seededUnit(poolKey, botIndex, 24) * Math.min(4, outcomeCount)) + 1,
    ),
  );

  return { totalPoints, exactCount, outcomeCount, goalsCount, bestStreak };
}

function buildSimulatedBotStats(
  poolKey: string,
  botIndex: number,
  ctx: RankingBotPoolContext,
): Pick<
  LeaderboardRow,
  "totalPoints" | "exactCount" | "outcomeCount" | "goalsCount" | "bestStreak"
> {
  const games = Math.max(1, Math.min(20, ctx.estimatedGamesInPool ?? 10));
  const progress = poolScoringProgress(ctx);
  const real = ctx.realPool ?? summarizeRealPool([]);
  const maxReal = real.maxPoints;
  const poolCap = games * 6;

  if (!ctx.hasResultedMatches && progress <= 0 && maxReal <= 0) {
    return statsFromPoints(poolKey, botIndex, 0, games, real);
  }

  let totalPoints: number;

  if (maxReal > 0) {
    // Espelha o líder real (ex.: 40 pts) — top 10 fica logo acima, sem escada 44, 43, 42…
    const spread = Math.min(
      6,
      Math.max(3, Math.floor(maxReal * 0.1) + 3 + Math.floor(seededUnit(poolKey, 9, 51) * 2)),
    );
    const topPts = maxReal;
    const bottomPts = Math.max(
      real.tenthRealPoints + 1,
      topPts - spread,
      0,
    );

    const rankT = botIndex / Math.max(1, RANKING_TOP10_BOT_COUNT - 1);
    const base = topPts - (topPts - bottomPts) * rankT;
    const jitter = Math.floor(seededUnit(poolKey, botIndex, 55) * 3) - 1;
    totalPoints = Math.round(base + jitter);
    totalPoints = Math.min(topPts, Math.max(bottomPts, totalPoints));

    if (botIndex === 0) {
      totalPoints = Math.min(totalPoints, maxReal);
    }
    if (botIndex === RANKING_TOP10_BOT_COUNT - 1) {
      totalPoints = Math.max(totalPoints, bottomPts);
      totalPoints = Math.min(totalPoints, Math.max(bottomPts, maxReal - 1));
    }
  } else {
    const topAtFull = Math.floor(games * 6 * 0.55);
    const bottomAtFull = Math.max(0, Math.floor(topAtFull * 0.45));
    const rankT = botIndex / Math.max(1, RANKING_TOP10_BOT_COUNT - 1);
    const targetAtFull = Math.round(topAtFull - (topAtFull - bottomAtFull) * rankT);
    totalPoints = Math.floor(targetAtFull * progress);
  }

  totalPoints = Math.min(totalPoints, poolCap);

  return statsFromPoints(poolKey, botIndex, totalPoints, games, real);
}

function clampBotsToRealPool(
  bots: LeaderboardRow[],
  real: RealPoolSnapshot,
  poolKey: string,
  games: number,
): void {
  if (real.maxPoints <= 0 || bots.length === 0) return;

  const capTop = real.maxPoints;
  const floorLast = Math.max(real.tenthRealPoints + 1, real.maxPoints - 6);

  const first = bots[0]!;
  if (first.totalPoints > capTop) {
    Object.assign(first, statsFromPoints(poolKey, 0, capTop, games, real));
  }

  const last = bots[bots.length - 1]!;
  if (last.totalPoints < floorLast) {
    Object.assign(
      last,
      statsFromPoints(poolKey, bots.length - 1, floorLast, games, real),
    );
  }
}

function enforceBotLeaderboardOrder(
  bots: LeaderboardRow[],
  poolKey: string,
  real: RealPoolSnapshot,
  games: number,
): void {
  bots.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.userId.localeCompare(b.userId);
  });

  for (let i = 1; i < bots.length; i++) {
    const prev = bots[i - 1]!;
    const cur = bots[i]!;
    if (cur.totalPoints >= prev.totalPoints) {
      const step = seededUnit(poolKey, i, 60) > 0.55 ? 2 : 1;
      const nextPts = Math.max(0, prev.totalPoints - step);
      Object.assign(cur, statsFromPoints(poolKey, i, nextPts, games, real));
    }
  }
}

function generateTop10SimulatedBots(
  poolKey: string,
  ctx: RankingBotPoolContext,
): LeaderboardRow[] {
  const poolHash = hashString(poolKey);
  const bots: LeaderboardRow[] = [];
  const games = Math.max(1, Math.min(20, ctx.estimatedGamesInPool ?? 10));
  const real = ctx.realPool ?? summarizeRealPool([]);
  const displayNames = shuffledBotNamesForPool(poolKey, RANKING_TOP10_BOT_COUNT);

  for (let i = 0; i < RANKING_TOP10_BOT_COUNT; i++) {
    const stats = buildSimulatedBotStats(poolKey, i, ctx);
    bots.push({
      pos: 0,
      ticketId: `${BOT_TICKET_PREFIX}${poolHash}:${i}`,
      userId: `${BOT_USER_PREFIX}${poolHash}:${i}`,
      displayName: displayNames[i] ?? `Jogador ${i + 1}`,
      avatarIndex: clampAvatarIndex(Math.floor(seededUnit(poolKey, i, 30) * 5)),
      avatarUploadFilename: null,
      isFiller: true,
      ...stats,
    });
  }

  clampBotsToRealPool(bots, real, poolKey, games);
  enforceBotLeaderboardOrder(bots, poolKey, real, games);

  return bots;
}

function generateTailBots(
  poolKey: string,
  count: number,
): LeaderboardRow[] {
  if (count <= 0) return [];
  const poolHash = hashString(poolKey);
  const rows: LeaderboardRow[] = [];
  const displayNames = shuffledBotNamesForPool(`${poolKey}|tail`, count);

  for (let i = 0; i < count; i++) {
    rows.push({
      pos: 0,
      ticketId: `${BOT_TICKET_PREFIX}${poolHash}:tail:${i}`,
      userId: `${BOT_USER_PREFIX}${poolHash}:tail:${i}`,
      displayName: displayNames[i] ?? `Jogador ${i + 1}`,
      avatarIndex: clampAvatarIndex(Math.floor(seededUnit(poolKey, i, 31) * 5)),
      avatarUploadFilename: null,
      isFiller: true,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      goalsCount: 0,
      bestStreak: 0,
    });
  }
  return rows;
}

/**
 * Bots preenchem vaga visual; quem tem mais pontos (real) sempre sobe no ranking.
 * Empate no topo: cotas reais ficam acima dos simulados.
 */
export function mergeRankingWithBots(
  realRows: LeaderboardRow[],
  poolKey: string,
  ctx: RankingBotPoolContext,
): LeaderboardRow[] {
  const real = realRows.map((r) => ({ ...r, isFiller: false as const }));

  if (!rankingBotsEnabled()) {
    return [...real]
      .sort(compareLeaderboardEntries)
      .map((r, idx) => ({ ...r, pos: idx + 1 }));
  }

  const ctxWithReal: RankingBotPoolContext = {
    ...ctx,
    realPool: ctx.realPool ?? summarizeRealPool(real),
  };
  const topBots = generateTop10SimulatedBots(poolKey, ctxWithReal);

  const minList = rankingMinDisplayParticipants();
  const tailCount = Math.max(0, minList - RANKING_TOP10_BOT_COUNT - real.length);
  const tailBots = generateTailBots(poolKey, tailCount);

  const merged = [...real, ...topBots, ...tailBots].sort(compareLeaderboardEntries);
  return merged.map((r, idx) => ({ ...r, pos: idx + 1 }));
}
