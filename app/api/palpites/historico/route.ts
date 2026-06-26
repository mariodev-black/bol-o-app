import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMap } from "@/lib/football-api";
import { ensureCompetitionIdsForBolaoExtra } from "@/lib/boloes/match-cache-competition-id";
import { resolveBolaoMatchFromMap, ensureSkaleBolaoMatchesMirrored } from "@/lib/boloes/skale-match-resolve";
import { calcPredictionPoints, listPredictions, type PredictionBolaoType } from "@/lib/predictions";
import {
  formatRankingHistoricoLiveLabel,
  isRankingHistoricoLive,
} from "@/lib/ranking/historico-display";
import {
  filterPredictionsForExtraTicketRound,
  resolveExtraTicketRoundScope,
} from "@/lib/palpites/extra-ticket-round-scope";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { fetchExtraChampionshipIdByTicketIds } from "@/lib/ticket-competition-server";

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
  let bolaoType: PredictionBolaoType | undefined;
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (!inferred) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
    if (inferred === "artilheiros") {
      return NextResponse.json({ rows: [] });
    }
    bolaoType = inferred;
  } else if (bolaoParam === "diario") {
    bolaoType = "diario";
  } else if (bolaoParam === "principal") {
    bolaoType = "principal";
  } else if (bolaoParam === "extra") {
    bolaoType = "extra";
  } else {
    bolaoType = undefined;
  }
  const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
  const mainComp = getFootballMainCompetitionId();
  const predsRaw = await listPredictions({ userId, bolaoType, ticketId });
  const extraMap = await fetchExtraChampionshipIdByTicketIds(
    [...new Set(predsRaw.filter((p) => p.bolao_type === "extra").map((p) => p.ticket_id))],
  );
  await ensureSkaleBolaoMatchesMirrored();
  const ensureIds = new Set<number>([mainComp]);
  if (bolaoType === "extra") {
    for (const cid of extraMap.values()) {
      if (cid != null && Number.isFinite(cid) && cid > 0) {
        for (const id of ensureCompetitionIdsForBolaoExtra(cid)) ensureIds.add(id);
      }
    }
    const cidParam = request.nextUrl.searchParams.get("championshipId");
    const cidFromQuery = cidParam != null ? Number(cidParam) : NaN;
    if (Number.isFinite(cidFromQuery) && cidFromQuery > 0) {
      for (const id of ensureCompetitionIdsForBolaoExtra(cidFromQuery)) ensureIds.add(id);
    }
  }
  const matches = await fetchMatchesMap({
    ensureCompetitionIds: [...ensureIds],
  });

  let preds = predsRaw;
  if (bolaoType === "extra" && ticketId) {
    const roundScope = await resolveExtraTicketRoundScope(ticketId);
    if (roundScope) {
      preds = filterPredictionsForExtraTicketRound(preds, roundScope, matches);
    }
  }

  const rows = preds
    .map((p) => {
      const matchId = Number(p.match_id);
      const normalizedMatchId = Number.isFinite(matchId) ? matchId : null;
      const comp = p.bolao_type === "extra" ? extraMap.get(p.ticket_id) ?? null : mainComp;
      const m =
        normalizedMatchId != null && comp != null && Number.isFinite(comp) && comp > 0
          ? resolveBolaoMatchFromMap(matches, comp, normalizedMatchId)
          : undefined;
      const resultadoCasa = m?.resultCasa ?? null;
      const resultadoVisitante = m?.resultVisitante ?? null;
      const hasScore = resultadoCasa != null && resultadoVisitante != null;
      const calc =
        hasScore && m
          ? calcPredictionPoints(
              p.score_casa,
              p.score_visitante,
              resultadoCasa,
              resultadoVisitante,
            )
          : null;
      const matchInput = {
        matchStatus: m?.status ?? null,
        kickoffAt: m?.kickoffAt ?? null,
        jogoData: m?.dateBR,
        jogoHora: m?.hour,
        resultadoCasa,
        resultadoVisitante,
      };
      const aoVivo = m ? isRankingHistoricoLive(matchInput) : false;
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
        resultadoCasa,
        resultadoVisitante,
        pontos: calc?.points ?? 0,
        exact: calc?.exact ?? false,
        aoVivo,
        liveLabel: aoVivo ? formatRankingHistoricoLiveLabel(matchInput) : null,
        matchStatus: m?.status ?? null,
        kickoffAt: m?.kickoffAt ?? null,
        submittedAt: p.submitted_at.toISOString(),
        updatedAt: p.updated_at.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);

  return NextResponse.json({ historico: rows });
}

