/** Deep link do ranking para um palpite específico (PWA push). */
export function rankingPalpitePushPath(
  ticketId: string,
  matchId: number | string,
): string {
  const ticket = String(ticketId ?? "").trim();
  const match = String(matchId ?? "").trim();
  if (!ticket || !match) return "/ranking";
  const q = new URLSearchParams({ ticket, match });
  return `/ranking?${q.toString()}`;
}

export function parseRankingPalpitePushParams(searchParams: {
  get(name: string): string | null;
}): { ticketId: string; matchId: string | null } {
  const ticketId =
    searchParams.get("ticket")?.trim() ||
    searchParams.get("ticketId")?.trim() ||
    searchParams.get("default")?.trim() ||
    "";
  const matchId = searchParams.get("match")?.trim() || null;
  return { ticketId, matchId };
}

export function rankingMatchDomId(matchId: number | string): string {
  return `ranking-match-${String(matchId)}`;
}
