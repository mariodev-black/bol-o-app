import { adminSaveTicketPrediction } from "@/lib/admin/admin-upsert-prediction";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

export const runtime = "nodejs";

const scoreSchema = z.number().int().min(0).max(99);

const bodySchema = z.object({
  matchId: z.number().int().positive(),
  competitionId: z.number().int().positive().optional().nullable(),
  resultCasa: scoreSchema.optional().nullable(),
  resultVisitante: scoreSchema.optional().nullable(),
  scoreCasa: scoreSchema,
  scoreVisitante: scoreSchema,
  pointsOverride: z.number().int().min(0).max(99).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { ticketId } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const result = await adminSaveTicketPrediction({
      ticketId,
      matchId: parsed.data.matchId,
      competitionId: parsed.data.competitionId,
      resultCasa: parsed.data.resultCasa,
      resultVisitante: parsed.data.resultVisitante,
      scoreCasa: parsed.data.scoreCasa,
      scoreVisitante: parsed.data.scoreVisitante,
      pointsOverride: parsed.data.pointsOverride,
    });

    revalidateTag("leaderboard", "max");

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar palpite";
    const status = message.includes("não encontrada") || message.includes("fora do escopo") ? 400 : 500;
    console.error("[admin/cotas/predictions]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
