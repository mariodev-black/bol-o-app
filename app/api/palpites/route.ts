import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { filterPredictionsToOfficialMatchIds } from "@/lib/matches-cache";
import { buildPalpiteSaveContext } from "@/lib/palpites/palpite-save-context";
import { recomputePredictionScoresForSavedMatches } from "@/lib/palpites/recompute-saved-matches";
import { resolveOwnedTicketMeta } from "@/lib/palpites/ticket-meta";
import { validatePalpiteForSave } from "@/lib/palpites/validate-palpite-save";
import { listPredictions, upsertPrediction } from "@/lib/predictions";

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
  const rowsOfficial = await filterPredictionsToOfficialMatchIds(rows, {
    competitionId: filterComp,
  });
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
  const built = await buildPalpiteSaveContext(userId, data.ticketId);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }
  const { ctx } = built;

  const validationError = await validatePalpiteForSave(ctx, data);
  if (validationError) {
    return NextResponse.json(
      { error: validationError.error },
      { status: validationError.status },
    );
  }

  const row = await upsertPrediction({
    userId: ctx.userId,
    ticketId: ctx.ticketId,
    bolaoType: ctx.bolaoType,
    matchId: data.matchId,
    scoreCasa: data.scoreCasa,
    scoreVisitante: data.scoreVisitante,
  });

  await recomputePredictionScoresForSavedMatches([data.matchId]);
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
