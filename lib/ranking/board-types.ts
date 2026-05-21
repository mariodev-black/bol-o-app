export type RankingBoardRow = {
  pos: number;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  isMe?: boolean;
};

export type RankingBoardMeta = {
  participantCount: number;
  revenueCents: number;
  poolCentsApprox: number;
  nextPalpiteLockMs: number | null;
  approxPremiados: number;
  hasResultedMatchesInPool?: boolean;
};

export function emptyRankingBoardMeta(): RankingBoardMeta {
  return {
    participantCount: 0,
    revenueCents: 0,
    poolCentsApprox: 0,
    nextPalpiteLockMs: null,
    approxPremiados: 0,
    hasResultedMatchesInPool: false,
  };
}
