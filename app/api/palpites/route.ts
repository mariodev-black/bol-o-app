import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMap } from "@/lib/football-api";
import { listPredictions, upsertPrediction } from "@/lib/predictions";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind";

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
      matchId: r.match_id,
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
  if (String(match.status).toLowerCase() !== "agendado" && String(match.status).toLowerCase() !== "aberto") {
    return NextResponse.json({ error: "Partida ja encerrada para palpites" }, { status: 400 });
  }
  const lockMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() - 60 * 60 * 1000 : null;
  if (lockMs != null && Date.now() >= lockMs) {
    return NextResponse.json({ error: "Palpite bloqueado: faltam menos de 1h para a partida" }, { status: 400 });
  }
  if (bolaoType === "diario") {
    const today = brToday();
    if (match.dateBR !== today) {
      return NextResponse.json({ error: "Ticket diario so permite jogos do dia atual" }, { status: 400 });
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
      matchId: row.match_id,
      scoreCasa: row.score_casa,
      scoreVisitante: row.score_visitante,
      submittedAt: row.submitted_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  });
}

