import { getPool } from "@/lib/db";
import { brToday, minBrDate, resolveDiarioPlayableDate, utcMsForBrDate } from "@/lib/diario-playable-date";
import { fetchMatchesMap } from "@/lib/football-api";
import { listPredictionTicketMatchPairsForUser } from "@/lib/predictions";

export type PaidTicketRow = {
  id: string;
  ticketType: "general" | "daily";
  quantity: number;
  paidAt: string | null;
  createdAt: string;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  playDate?: string | null;
  availableGames?: number;
};

function isFinishedStatus(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

function parseKickoffUtcMs(dateBR?: string, hourBR?: string): number | null {
  if (!dateBR) return null;
  const [d, m, y] = String(dateBR).split("/");
  if (!d || !m || !y) return null;
  const [hh, mm] = String(hourBR || "00:00").split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

/** Tickets com pagamento confirmado (origem do banco — fonte de verdade). */
export async function listPaidTicketsForUser(userId: string): Promise<PaidTicketRow[]> {
  const pool = getPool();
  try {
    const [{ rows }, matchMap, preds] = await Promise.all([
      pool.query<{
        id: string;
        ticket_type: "general" | "daily";
        quantity: number;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `SELECT id, ticket_type, quantity, paid_at, created_at
         FROM tickets
         WHERE user_id = $1 AND status = 'paid'
         ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST, created_at DESC`,
        [userId]
      ),
      fetchMatchesMap().catch(() => new Map()),
      listPredictionTicketMatchPairsForUser(userId).catch(() => [] as { ticket_id: string; match_id: number }[]),
    ]);
    const mapped = rows.map((r) => ({
      id: r.id,
      ticketType: r.ticket_type,
      quantity: Math.max(1, r.quantity),
      paidAt: r.paid_at ? r.paid_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));
    if (!matchMap.size) {
      return mapped.map((t) => ({
        ...t,
        dailyStatus: t.ticketType === "daily" ? "disponivel" : undefined,
        playDate: t.ticketType === "daily" ? brToday() : undefined,
        availableGames: 0,
      }));
    }

    const now = Date.now();
    const today = brToday();
    const todayMs = utcMsForBrDate(today) ?? now;
    const openMatches = Array.from(matchMap.entries())
      .map(([matchId, m]) => ({
        matchId: Number(matchId),
        dateBR: m.dateBR,
        status: m.status,
        kickoffAt: parseKickoffUtcMs(m.dateBR, m.hourBR),
      }))
      .filter((m) => {
        const finished = isFinishedStatus(m.status);
        const lockAt = m.kickoffAt != null ? m.kickoffAt - 60 * 60 * 1000 : null;
        const dateMs = m.dateBR ? utcMsForBrDate(m.dateBR) : null;
        const stillOpenByTime = lockAt != null ? lockAt > now : (dateMs ?? 0) >= todayMs;
        return !finished && stillOpenByTime;
      });

    const playableDate = resolveDiarioPlayableDate(matchMap);
    const byTicket = new Map<string, { ticket_id: string; match_id: number }[]>();
    for (const p of preds) {
      const arr = byTicket.get(p.ticket_id) ?? [];
      arr.push(p);
      byTicket.set(p.ticket_id, arr);
    }

    const result = mapped.map((t) => {
      if (t.ticketType !== "daily") {
        const ticketPreds = byTicket.get(t.id) ?? [];
        const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
        const availableGames = openMatches.reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
        return { ...t, availableGames };
      }

      const ticketPreds = byTicket.get(t.id) ?? [];
      if (ticketPreds.length === 0) {
        const availableGames = openMatches.filter((m) => m.dateBR === playableDate).length;
        return { ...t, dailyStatus: "disponivel" as const, playDate: playableDate, availableGames };
      }

      const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
      const matchDates = new Set<string>();
      let allFinished = true;
      for (const p of ticketPreds) {
        const m = matchMap.get(Number(p.match_id));
        if (m?.dateBR) matchDates.add(m.dateBR);
        const finished = m ? isFinishedStatus(m.status) || (m.resultCasa != null && m.resultVisitante != null) : true;
        if (!finished) allFinished = false;
      }
      const predDate = minBrDate(matchDates);
      const predMinMs = predDate ? utcMsForBrDate(predDate) : null;
      const todayCalMs = utcMsForBrDate(today);
      const usedByDate =
        predMinMs != null && todayCalMs != null && predMinMs < todayCalMs;
      const dailyStatus: NonNullable<PaidTicketRow["dailyStatus"]> = allFinished || usedByDate ? "usado" : "em_uso";
      const targetDate = predDate ?? playableDate;
      const availableGames = openMatches
        .filter((m) => m.dateBR === targetDate)
        .reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
      return { ...t, dailyStatus, playDate: targetDate, availableGames };
    });
    return result;
  } catch (e) {
    console.error("[user-tickets] listPaidTicketsForUser", e);
    return [];
  }
}
