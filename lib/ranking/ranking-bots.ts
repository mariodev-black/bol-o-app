/** Identificadores legados de linhas simuladas (não são mais geradas). */

const BOT_USER_PREFIX = "ranking-bot:";
const BOT_TICKET_PREFIX = "ranking-bot-ticket:";
const LEGACY_FILLER_USER_PREFIX = "ranking-filler:";
const LEGACY_FILLER_TICKET_PREFIX = "ranking-filler-ticket:";

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

export function rankingFillerAvatarUserId(userId: string): string {
  return String(userId);
}
