import type { LeaderboardRow } from "@/lib/ranking/leaderboard";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";

const BOT_USER_PREFIX = "ranking-bot:";
const BOT_TICKET_PREFIX = "ranking-bot-ticket:";
const LEGACY_FILLER_USER_PREFIX = "ranking-filler:";
const LEGACY_FILLER_TICKET_PREFIX = "ranking-filler-ticket:";

export const RANKING_TOP10_BOT_COUNT = 10;

export type RankingBotPoolContext = {
  hasResultedMatches: boolean;
  estimatedGamesInPool?: number;
  finishedGamesInPool?: number;
  liveGamesInPool?: number;
};

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

function compareRealEntries(a: LeaderboardRow, b: LeaderboardRow): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
  if (b.outcomeCount !== b.outcomeCount) return b.outcomeCount - a.outcomeCount;
  if (b.goalsCount !== b.goalsCount) return b.goalsCount - a.goalsCount;
  if (b.bestStreak !== b.bestStreak) return b.bestStreak - a.bestStreak;
  return a.ticketId.localeCompare(b.ticketId);
}

function botDisplayName(
  poolKey: string,
  botIndex: number,
  usedNames: Set<string>,
): string {
  const total = SIMULATED_FULL_NAMES.length;
  for (let attempt = 0; attempt < total; attempt++) {
    const idx = Math.floor(seededUnit(poolKey, botIndex, 1 + attempt) * total);
    const name = SIMULATED_FULL_NAMES[idx]!;
    const key = name.toLowerCase();
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return name;
    }
  }
  const fallback = SIMULATED_FULL_NAMES[botIndex % total]!;
  usedNames.add(fallback.toLowerCase());
  return fallback;
}

/** 0 = rodada não começou; 1 = todos os jogos encerrados (com peso ao vivo no meio). */
function poolScoringProgress(ctx: RankingBotPoolContext): number {
  const total = Math.max(1, ctx.estimatedGamesInPool ?? 10);
  const finished = Math.max(0, ctx.finishedGamesInPool ?? 0);
  const live = Math.max(0, ctx.liveGamesInPool ?? 0);
  const liveWeight = 0.45;
  return Math.min(1, (finished + live * liveWeight) / total);
}

function statsFromPoints(
  poolKey: string,
  botIndex: number,
  totalPoints: number,
  games: number,
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

  const exactCount =
    totalPoints >= 9
      ? Math.min(3, Math.floor(seededUnit(poolKey, botIndex, 20) * 3) + 1)
      : totalPoints >= 4 && seededUnit(poolKey, botIndex, 21) > 0.5
        ? 1
        : 0;

  const outcomeCount = Math.max(
    exactCount,
    Math.min(games, exactCount + Math.floor(seededUnit(poolKey, botIndex, 22) * 5) + 2),
  );
  const goalsCount = Math.max(
    outcomeCount,
    outcomeCount + Math.floor(seededUnit(poolKey, botIndex, 23) * 4),
  );
  const bestStreak = Math.min(
    outcomeCount,
    Math.max(exactCount > 0 ? 1 : 0, Math.floor(seededUnit(poolKey, botIndex, 24) * 4) + 1),
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

  if (!ctx.hasResultedMatches && progress <= 0) {
    return statsFromPoints(poolKey, botIndex, 0, games);
  }

  const maxPerGame = 3;
  const poolCap = games * maxPerGame;
  const rankBias = (RANKING_TOP10_BOT_COUNT - 1 - botIndex) / RANKING_TOP10_BOT_COUNT;
  const fullTarget = Math.floor(
    poolCap * (0.55 + rankBias * 0.4) + seededUnit(poolKey, botIndex, 3) * 4,
  );
  const minTarget = Math.max(0, fullTarget - 6);
  const targetAtFull =
    minTarget + Math.floor(seededUnit(poolKey, botIndex, 4) * (fullTarget - minTarget));

  let totalPoints = Math.floor(targetAtFull * progress);

  if (progress > 0 && totalPoints < 1) {
    totalPoints = 1;
  }

  if (progress > 0.05) {
    totalPoints += Math.max(0, RANKING_TOP10_BOT_COUNT - 1 - botIndex);
  }

  const maxAllowed = Math.floor(poolCap * progress) + RANKING_TOP10_BOT_COUNT;
  totalPoints = Math.min(totalPoints, maxAllowed);

  return statsFromPoints(poolKey, botIndex, totalPoints, games);
}

function generateTop10SimulatedBots(
  poolKey: string,
  ctx: RankingBotPoolContext,
  usedNames: Set<string>,
): LeaderboardRow[] {
  const poolHash = hashString(poolKey);
  const bots: LeaderboardRow[] = [];

  for (let i = 0; i < RANKING_TOP10_BOT_COUNT; i++) {
    const stats = buildSimulatedBotStats(poolKey, i, ctx);
    bots.push({
      pos: 0,
      ticketId: `${BOT_TICKET_PREFIX}${poolHash}:${i}`,
      userId: `${BOT_USER_PREFIX}${poolHash}:${i}`,
      displayName: botDisplayName(poolKey, i, usedNames),
      avatarIndex: clampAvatarIndex(Math.floor(seededUnit(poolKey, i, 30) * 5)),
      avatarUploadFilename: null,
      isFiller: true,
      ...stats,
    });
  }

  bots.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.userId.localeCompare(b.userId);
  });

  return bots;
}

function generateTailBots(
  poolKey: string,
  count: number,
  startIndex: number,
  usedNames: Set<string>,
): LeaderboardRow[] {
  if (count <= 0) return [];
  const poolHash = hashString(poolKey);
  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    rows.push({
      pos: 0,
      ticketId: `${BOT_TICKET_PREFIX}${poolHash}:tail:${idx}`,
      userId: `${BOT_USER_PREFIX}${poolHash}:tail:${idx}`,
      displayName: botDisplayName(poolKey, idx + 20, usedNames),
      avatarIndex: clampAvatarIndex(Math.floor(seededUnit(poolKey, idx, 31) * 5)),
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
 * Sempre 10 jogadores simulados no topo; reais a partir do 11º.
 * Pontuação dos bots sobe conforme jogos encerram / estão ao vivo.
 */
export function mergeRankingWithBots(
  realRows: LeaderboardRow[],
  poolKey: string,
  ctx: RankingBotPoolContext,
): LeaderboardRow[] {
  const real = [...realRows]
    .map((r) => ({ ...r, isFiller: false as const }))
    .sort(compareRealEntries);

  if (!rankingBotsEnabled()) {
    return real.map((r, idx) => ({ ...r, pos: idx + 1 }));
  }

  const usedNames = new Set<string>();
  const topBots = generateTop10SimulatedBots(poolKey, ctx, usedNames);

  const minList = rankingMinDisplayParticipants();
  const tailCount = Math.max(0, minList - RANKING_TOP10_BOT_COUNT - real.length);
  const tailBots = generateTailBots(poolKey, tailCount, RANKING_TOP10_BOT_COUNT, usedNames);

  const merged = [...topBots, ...real, ...tailBots];
  return merged.map((r, idx) => ({ ...r, pos: idx + 1 }));
}
