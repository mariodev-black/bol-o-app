import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMap } from "@/lib/football-api";
import { getPredictionByUserTicketMatch, listPredictions, upsertPrediction } from "@/lib/predictions";
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

const postSchema = z.object({
  ticketId: z.string().min(1),
  matchId: z.number().int().positive(),
  scoreCasa: z.number().int().min(0).max(99),
  scoreVisitante: z.number().int().min(0).max(99),
});

function brToday(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function utcMsForBrDate(dateBR: string): number | null {
  const [d, m, y] = dateBR.split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month - 1, day);
}

function resolveDiarioPlayableDate(matchMap: Awaited<ReturnType<typeof fetchMatchesMap>>): string {
  const today = brToday();
  const todayMs = utcMsForBrDate(today);
  const dates = new Set<string>();
  for (const m of matchMap.values()) {
    if (m.dateBR) dates.add(m.dateBR);
  }
  if (dates.has(today)) return today;
  const sortedFuture = Array.from(dates)
    .map((d) => ({ d, ms: utcMsForBrDate(d) }))
    .filter((x): x is { d: string; ms: number } => x.ms != null && todayMs != null && x.ms >= todayMs)
    .sort((a, b) => a.ms - b.ms);
  return sortedFuture[0]?.d ?? today;
}

function isFinishedStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || undefined;
  let bolaoType: "principal" | "diario" | undefined =
    request.nextUrl.searchParams.get("bolaoType") === "diario"
      ? "diario"
      : request.nextUrl.searchParams.get("bolaoType") === "principal"
        ? "principal"
        : undefined;
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (!inferred) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
    bolaoType = inferred;
  }
  const rows = await listPredictions({ userId, bolaoType, ticketId });
  return NextResponse.json({
    predictions: rows.map((r) => ({
      ticketId: r.ticket_id,
      bolaoType: r.bolao_type,
      matchId: Number(r.match_id),
      scoreCasa: r.score_casa,
      scoreVisitante: r.score_visitante,
      submittedAt: r.submitted_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });

  const data = parsed.data;
  const bolaoType = await inferBolaoTypeFromTicketId(data.ticketId);
  if (!bolaoType) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
  const matchMap = await fetchMatchesMap();
  const match = matchMap.get(data.matchId);
  if (!match) return NextResponse.json({ error: "Partida nao encontrada" }, { status: 404 });

  const status = String(match.status || "");
  if (isFinishedStatus(status) || (match.resultCasa != null && match.resultVisitante != null)) {
    return NextResponse.json({ error: "Partida ja encerrada para palpites" }, { status: 400 });
  }

  const lockMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() - 60 * 60 * 1000 : null;
  if (lockMs != null && Date.now() >= lockMs) {
    return NextResponse.json({ error: "Palpite bloqueado: faltam menos de 1h para a partida" }, { status: 400 });
  }
  const kickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : null;
  if (kickoffMs != null && Number.isFinite(kickoffMs) && Date.now() >= kickoffMs) {
    return NextResponse.json({ error: "Partida ja iniciada para palpites" }, { status: 400 });
  }
  if (bolaoType === "diario") {
    const today = brToday();
    const playableDate = resolveDiarioPlayableDate(matchMap);
    const ticketPreds = await listPredictions({ userId, ticketId: data.ticketId, bolaoType: "diario" });
    if (ticketPreds.length > 0) {
      let hasDateMismatch = false;
      let allFinished = true;
      for (const p of ticketPreds) {
        const m = matchMap.get(Number(p.match_id));
        const date = m?.dateBR ?? null;
        if (date && date !== playableDate) hasDateMismatch = true;
        const status = String(m?.status || "").toLowerCase();
        const finished =
          !m ||
          status.includes("encerr") ||
          status.includes("finaliz") ||
          status.includes("cancel") ||
          status.includes("adiad") ||
          status.includes("suspens") ||
          status.includes("interromp") ||
          (m.resultCasa != null && m.resultVisitante != null);
        if (!finished) allFinished = false;
      }
      if (hasDateMismatch || allFinished) {
        return NextResponse.json({ error: "Ticket diario ja usado e encerrado para novo uso" }, { status: 400 });
      }
    }
    if (match.dateBR !== playableDate) {
      return NextResponse.json({ error: "Ticket diario so permite jogos do dia atual" }, { status: 400 });
    }
    const existing = await getPredictionByUserTicketMatch({
      userId,
      ticketId: data.ticketId,
      matchId: data.matchId,
    });
    if (existing) {
      const submittedDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(existing.submitted_at);
      if (playableDate === today && submittedDay !== today) {
        return NextResponse.json(
          { error: "Ticket diario so permite alterar palpites criados no dia atual" },
          { status: 400 }
        );
      }
    }
    const matchDayMs = utcMsForBrDate(match.dateBR);
    const playableDayMs = utcMsForBrDate(playableDate);
    if (matchDayMs == null || playableDayMs == null || matchDayMs !== playableDayMs) {
      return NextResponse.json({ error: "Ticket diario valido apenas para jogos do dia" }, { status: 400 });
    }
  }

  const row = await upsertPrediction({
    userId,
    ticketId: data.ticketId,
    bolaoType,
    matchId: data.matchId,
    scoreCasa: data.scoreCasa,
    scoreVisitante: data.scoreVisitante,
  });
  return NextResponse.json({
    prediction: {
      ticketId: row.ticket_id,
      bolaoType: row.bolao_type,
      matchId: Number(row.match_id),
      scoreCasa: row.score_casa,
      scoreVisitante: row.score_visitante,
      submittedAt: row.submitted_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  });
}

