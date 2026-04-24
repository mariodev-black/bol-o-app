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
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || undefined;
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
  const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
  const preds = await listPredictions({ userId, bolaoType, ticketId });
  const matches = await fetchMatchesMap();

  const rows = preds
    .map((p) => {
      const matchId = Number(p.match_id);
      const normalizedMatchId = Number.isFinite(matchId) ? matchId : null;
      const m = normalizedMatchId != null ? matches.get(normalizedMatchId) : undefined;
      const scored = m?.resultCasa != null && m?.resultVisitante != null;
      const calc =
        scored && m
          ? calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa!, m.resultVisitante!)
          : null;
      return {
        matchId: normalizedMatchId ?? p.match_id,
        ticketId: p.ticket_id,
        bolaoType: p.bolao_type,
        mandante: m?.homeName ?? m?.home ?? `Partida #${normalizedMatchId ?? p.match_id}`,
        visitante: m?.awayName ?? m?.away ?? "-",
        escudoMandante: m?.homeLogo ?? null,
        escudoVisitante: m?.awayLogo ?? null,
        jogoData: m?.dateBR ?? "-",
        jogoHora: m?.hour ?? "-",
        palpiteCasa: p.score_casa,
        palpiteVisitante: p.score_visitante,
        resultadoCasa: m?.resultCasa ?? null,
        resultadoVisitante: m?.resultVisitante ?? null,
        pontos: calc?.points ?? 0,
        exact: calc?.exact ?? false,
        submittedAt: p.submitted_at.toISOString(),
        updatedAt: p.updated_at.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);

  return NextResponse.json({ historico: rows });
}

