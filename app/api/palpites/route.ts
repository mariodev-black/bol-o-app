import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { fetchMatchesMapDirectFromDb, getMatchFromMap, resolveKickoffAtIso } from "@/lib/football-api";
import { getPredictionByUserTicketMatch, listPredictions, palpiteLockBeforeKickoffMs, upsertPrediction } from "@/lib/predictions";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind-shared";
import { getPool } from "@/lib/db";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { brToday, resolveDiarioPlayableDate, utcMsForBrDate } from "@/lib/diario-playable-date";
import { filterPredictionsToOfficialMatchIds } from "@/lib/matches-cache";

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

function isUuidTicketId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

async function resolveOwnedTicketMeta(
  userId: string,
  ticketId: string
): Promise<{ bolao: "principal" | "diario" | "extra"; extraChampionshipId: number | null } | null> {
  const raw = ticketId.trim();
  if (!raw) return null;

  const fromPrefix = inferBolaoTypeFromTicketPrefix(raw);
  if (fromPrefix && !isUuidTicketId(raw)) {
    return { bolao: fromPrefix, extraChampionshipId: null };
  }

  if (isUuidTicketId(raw)) {
    const pool = getPool();
    const { rows } = await pool.query<{
      ticket_type: "general" | "daily" | "extra";
      extra_championship_id: number | null;
    }>(
      `SELECT ticket_type, extra_championship_id
       FROM tickets
       WHERE id::text = $1
         AND user_id = $2
         AND status = 'paid'
       LIMIT 1`,
      [raw, userId],
    );
    const tt = rows[0]?.ticket_type;
    if (tt === "general") return { bolao: "principal", extraChampionshipId: null };
    if (tt === "daily") return { bolao: "diario", extraChampionshipId: null };
    if (tt === "extra") {
      const cid = rows[0]?.extra_championship_id;
      if (cid != null && Number.isFinite(Number(cid))) {
        return { bolao: "extra", extraChampionshipId: Number(cid) };
      }
      const sole = getSoleConfiguredExtraChampionshipId();
      if (sole != null) return { bolao: "extra", extraChampionshipId: sole };
      return null;
    }
    return null;
  }

  const inferred = await inferBolaoTypeFromTicketId(raw);
  if (!inferred) return null;
  return { bolao: inferred, extraChampionshipId: null };
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || undefined;
  let bolaoType: "principal" | "diario" | "extra" | undefined =
    request.nextUrl.searchParams.get("bolaoType") === "diario"
      ? "diario"
      : request.nextUrl.searchParams.get("bolaoType") === "principal"
        ? "principal"
        : request.nextUrl.searchParams.get("bolaoType") === "extra"
          ? "extra"
          : undefined;
  let filterComp: number | undefined;
  if (ticketId) {
    const inferred = await resolveOwnedTicketMeta(userId, ticketId);
    if (!inferred) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
    bolaoType = inferred.bolao;
    if (inferred.bolao === "extra" && inferred.extraChampionshipId != null) {
      filterComp = inferred.extraChampionshipId;
    } else if (inferred.bolao === "principal") {
      filterComp = getFootballMainCompetitionId();
    }
  }
  const rows = await listPredictions({ userId, bolaoType, ticketId });
  const rowsOfficial = await filterPredictionsToOfficialMatchIds(rows, { competitionId: filterComp });
  return NextResponse.json({
    predictions: rowsOfficial.map((r) => ({
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
  const meta = await resolveOwnedTicketMeta(userId, data.ticketId);
  if (!meta) return NextResponse.json({ error: "Ticket invalido" }, { status: 400 });
  const bolaoType = meta.bolao;
  const extraChampionshipId = meta.extraChampionshipId;
  /** Sempre `matches_cache` no Postgres (nao usa mapa em memoria da API). */
  const matchMap = await fetchMatchesMapDirectFromDb();
  const mainComp = getFootballMainCompetitionId();
  const scopedComp =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    Number.isFinite(Number(extraChampionshipId)) &&
    Number(extraChampionshipId) > 0
      ? Number(extraChampionshipId)
      : mainComp;
  const match = getMatchFromMap(matchMap, scopedComp, data.matchId);
  if (!match) {
    const scope =
      bolaoType === "diario" ? "bolao do dia" : bolaoType === "extra" ? "bolao extra" : "bolao geral";
    return NextResponse.json(
      {
        error: `Partida nao encontrada no calendario oficial (${scope}, matches_cache / competicao do servidor). Verifique o id ou aguarde a sincronizacao.`,
      },
      { status: 404 },
    );
  }
  if (bolaoType === "principal" && Number(match.competitionId) !== mainComp) {
    return NextResponse.json(
      {
        error:
          "Partida nao pertence ao campeonato principal (Copa). Use apenas jogos do bolao geral listados na competicao configurada.",
      },
      { status: 400 },
    );
  }
  if (bolaoType === "extra" && extraChampionshipId != null && Number(match.competitionId) !== extraChampionshipId) {
    return NextResponse.json(
      {
        error: `Partida nao pertence ao bolao extra (campeonato ${extraChampionshipId}).`,
      },
      { status: 400 },
    );
  }

  const dateBrDb = String(match.dateBR || "").trim();
  if (!dateBrDb) {
    return NextResponse.json(
      {
        error:
          "Partida sem data no banco (matches_cache.date_br). Nao e possivel validar o dia; aguarde sincronizacao ou contate suporte.",
      },
      { status: 400 },
    );
  }

  const status = String(match.status || "");
  if (isFinishedStatus(status) || (match.resultCasa != null && match.resultVisitante != null)) {
    return NextResponse.json({ error: "Partida ja encerrada para palpites" }, { status: 400 });
  }

  const kickoffIso = resolveKickoffAtIso({
    kickoffAt: match.kickoffAt,
    dateBR: dateBrDb,
    hour: match.hour,
  });
  const lockLeadMs = palpiteLockBeforeKickoffMs(bolaoType);
  const lockMs = kickoffIso ? new Date(kickoffIso).getTime() - lockLeadMs : null;
  if (lockMs != null && Number.isFinite(lockMs) && Date.now() >= lockMs) {
    const msg =
      bolaoType === "extra"
        ? "Palpite recusado: o prazo maximo e ate 5 minutos antes do apito. Apos esse limite nao aceita nem primeiro palpite nem alteracao."
        : "Palpite recusado: o prazo maximo e ate 1h antes do apito. Na ultima hora antes do jogo nao aceita nem primeiro palpite nem alteracao; quem nao registrou a tempo nao entra nesta partida.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const kickoffMs = kickoffIso ? new Date(kickoffIso).getTime() : null;
  if (kickoffMs != null && Number.isFinite(kickoffMs) && Date.now() >= kickoffMs) {
    return NextResponse.json(
      {
        error:
          "Palpite recusado: partida ja iniciada. Nao e possivel registrar nem alterar palpite apos o apito.",
      },
      { status: 400 }
    );
  }
  if (bolaoType === "diario" || bolaoType === "extra") {
    const today = brToday();
    const predBolao = bolaoType === "diario" ? "diario" : "extra";
    const scopeComp = bolaoType === "diario" ? mainComp : (extraChampionshipId as number);
    const ticketPreds = await listPredictions({ userId, ticketId: data.ticketId, bolaoType: predBolao });
    const lockIds = ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite);
    const playableDate = resolveDiarioPlayableDate(matchMap, {
      lockToMatchIds: lockIds,
      competitionId: scopeComp,
    });
    if (ticketPreds.length > 0) {
      let hasDateMismatch = false;
      let allFinished = true;
      for (const p of ticketPreds) {
        const m = getMatchFromMap(matchMap, scopeComp, Number(p.match_id));
        const date = m?.dateBR ?? null;
        if (date && date !== playableDate) hasDateMismatch = true;
        const st = String(m?.status || "").toLowerCase();
        const finished =
          !m ||
          st.includes("encerr") ||
          st.includes("finaliz") ||
          st.includes("cancel") ||
          st.includes("adiad") ||
          st.includes("suspens") ||
          st.includes("interromp") ||
          (m.resultCasa != null && m.resultVisitante != null);
        if (!finished) allFinished = false;
      }
      if (hasDateMismatch || allFinished) {
        return NextResponse.json(
          { error: "Este ticket diario/extra ja foi encerrado para novo uso" },
          { status: 400 },
        );
      }
    }
    if (dateBrDb !== playableDate) {
      return NextResponse.json(
        {
          error: `Ticket: esta partida esta no dia ${dateBrDb} (matches_cache); o ticket so aceita jogos do dia ${playableDate}.`,
        },
        { status: 400 },
      );
    }
    const existing = await getPredictionByUserTicketMatch({
      userId,
      ticketId: data.ticketId,
      matchId: data.matchId,
    });
    if (existing) {
      const submittedDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
        existing.submitted_at
      );
      if (playableDate === today && submittedDay !== today) {
        return NextResponse.json(
          { error: "Ticket diario/extra so permite alterar palpites criados no dia atual" },
          { status: 400 }
        );
      }
    }
    const matchDayMs = utcMsForBrDate(dateBrDb);
    const playableDayMs = utcMsForBrDate(playableDate);
    if (matchDayMs == null || playableDayMs == null || matchDayMs !== playableDayMs) {
      return NextResponse.json({ error: "Ticket valido apenas para jogos do dia da rodada" }, { status: 400 });
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
  // Se a partida já tem placar conhecido (raro: palpite no apito), gera a linha
  // em prediction_scores. Em jogo sem placar, points=0 — a próxima cascata
  // recomputa quando o placar mudar.
  try {
    const { getPool } = await import("@/lib/db");
    const { recomputePredictionScoresForMatches } = await import("@/lib/predictions/score-recompute");
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recomputePredictionScoresForMatches(client, [data.matchId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.warn("[api/palpites] recomputePredictionScores skipped:", err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[api/palpites] recompute boot failed:", err);
  }
  revalidateTag("leaderboard", "max");
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

