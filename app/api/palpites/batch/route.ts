import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildPalpiteSaveContext } from "@/lib/palpites/palpite-save-context";
import { recomputePredictionScoresForSavedMatches } from "@/lib/palpites/recompute-saved-matches";
import { validatePalpiteForSave } from "@/lib/palpites/validate-palpite-save";
import { upsertPrediction } from "@/lib/predictions";

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

const batchSchema = z.object({
  ticketId: z.string().min(1),
  palpites: z
    .array(
      z.object({
        matchId: z.number().int().positive(),
        scoreCasa: z.number().int().min(0).max(99),
        scoreVisitante: z.number().int().min(0).max(99),
      }),
    )
    .min(1)
    .max(64),
});

export async function POST(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const { ticketId, palpites } = parsed.data;
  const built = await buildPalpiteSaveContext(userId, ticketId);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }
  const { ctx } = built;

  for (const item of palpites) {
    const err = await validatePalpiteForSave(ctx, item);
    if (err) {
      return NextResponse.json({ error: err.error }, { status: err.status });
    }
  }

  const rows = [];
  for (const item of palpites) {
    const row = await upsertPrediction({
      userId: ctx.userId,
      ticketId: ctx.ticketId,
      bolaoType: ctx.bolaoType,
      matchId: item.matchId,
      scoreCasa: item.scoreCasa,
      scoreVisitante: item.scoreVisitante,
    });
    rows.push(row);
  }

  await recomputePredictionScoresForSavedMatches(
    palpites.map((p) => p.matchId),
  );
  revalidateTag("leaderboard", "max");

  return NextResponse.json({
    predictions: rows.map((row) => ({
      ticketId: row.ticket_id,
      bolaoType: row.bolao_type,
      matchId: Number(row.match_id),
      scoreCasa: row.score_casa,
      scoreVisitante: row.score_visitante,
      submittedAt: row.submitted_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  });
}
