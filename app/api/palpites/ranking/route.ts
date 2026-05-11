import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMap } from "@/lib/football-api";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";

export const runtime = "nodejs";

async function authUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() ?? null;
  const bolaoParam = request.nextUrl.searchParams.get("bolaoType");
  let bolaoType: "principal" | "diario" | undefined;
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (!inferred) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
    bolaoType = inferred;
  } else if (bolaoParam === "diario") {
    bolaoType = "diario";
  } else if (bolaoParam === "principal") {
    bolaoType = "principal";
  } else {
    bolaoType = undefined;
  }

  let preds = await listPredictions({ userId, bolaoType });
  const matches = await fetchMatchesMap();
  if (ticketId && bolaoType === "diario") {
    const selectedDates = new Set(
      preds
        .filter((p) => p.ticket_id === ticketId)
        .map((p) => matches.get(Number(p.match_id))?.dateBR)
        .filter((d): d is string => Boolean(d))
    );
    if (selectedDates.size > 0) {
      preds = preds.filter((p) => {
        const d = matches.get(Number(p.match_id))?.dateBR;
        return d ? selectedDates.has(d) : false;
      });
    } else {
      preds = preds.filter((p) => p.ticket_id === ticketId);
    }
  }
  const byTicket = new Map<string, {
    ticketId: string;
    totalPoints: number;
    exactCount: number;
    outcomeCount: number;
    goalsCount: number;
    bestStreak: number;
    firstSubmitAt: number;
    hitSequence: Array<{ order: number; hit: boolean }>;
  }>();

  for (const p of preds) {
    const matchId = Number(p.match_id);
    if (!Number.isFinite(matchId)) continue;
    const m = matches.get(matchId);
    if (!m || m.resultCasa == null || m.resultVisitante == null) continue;
    const cur =
      byTicket.get(p.ticket_id) ??
      {
        ticketId: p.ticket_id,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        bestStreak: 0,
        firstSubmitAt: new Date(p.submitted_at).getTime(),
        hitSequence: [],
      };
    const calc = calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa, m.resultVisitante);
    cur.totalPoints += calc.points;
    cur.exactCount += calc.exact ? 1 : 0;
    cur.outcomeCount += calc.outcomeHit ? 1 : 0;
    cur.goalsCount += calc.goalsHitCount;
    cur.hitSequence.push({
      order: m.kickoffAt ? new Date(m.kickoffAt).getTime() : matchId,
      hit: calc.points > 0,
    });
    const sub = new Date(p.submitted_at).getTime();
    if (sub < cur.firstSubmitAt) cur.firstSubmitAt = sub;
    byTicket.set(p.ticket_id, cur);
  }

  const rows = Array.from(byTicket.values()).map((row) => {
    let current = 0;
    for (const item of row.hitSequence.sort((a, b) => a.order - b.order)) {
      if (item.hit) {
        current += 1;
        row.bestStreak = Math.max(row.bestStreak, current);
      } else {
        current = 0;
      }
    }
    return row;
  }).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
    if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.firstSubmitAt - b.firstSubmitAt;
  });

  return NextResponse.json({
    ranking: rows.map((r, idx) => ({
      pos: idx + 1,
      ticketId: r.ticketId,
      totalPoints: r.totalPoints,
      exactCount: r.exactCount,
      outcomeCount: r.outcomeCount,
      goalsCount: r.goalsCount,
      bestStreak: r.bestStreak,
      firstSubmitAt: r.firstSubmitAt,
      isMe: ticketId ? ticketId === r.ticketId : false,
    })),
  });
}

