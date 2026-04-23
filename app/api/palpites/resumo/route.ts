import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMap } from "@/lib/football-api";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
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

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || undefined;
  let bolaoType = request.nextUrl.searchParams.get("bolaoType") === "diario" ? "diario" : "principal";
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (!inferred) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
    bolaoType = inferred;
  }
  const preds = await listPredictions({ userId, bolaoType, ticketId });
  const matches = await fetchMatchesMap();

  let palpites = 0;
  let acertos = 0;
  let pontos = 0;
  let exatos = 0;
  for (const p of preds) {
    palpites += 1;
    const m = matches.get(p.match_id);
    if (!m || m.resultCasa == null || m.resultVisitante == null) continue;
    const calc = calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa, m.resultVisitante);
    pontos += calc.points;
    acertos += calc.outcomeHit ? 1 : 0;
    exatos += calc.exact ? 1 : 0;
  }

  return NextResponse.json({
    resumo: { palpites, acertos, pontos, exatos },
  });
}

