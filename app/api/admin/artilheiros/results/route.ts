import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  applyArtilheiroOfficialResults,
  listArtilheiroOfficialResults,
  upsertArtilheiroOfficialDraft,
} from "@/lib/artilheiros/results";
import { buildArtilheiroRanking } from "@/lib/artilheiros/ranking";

export const runtime = "nodejs";

const slotSchema = z
  .object({
    slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    apiPlayerId: z.number().int().positive(),
    apiTeamId: z.number().int().positive(),
    goals: z.number().int().min(0).optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const results = await listArtilheiroOfficialResults();
  const ranking = await buildArtilheiroRanking(50);
  return NextResponse.json({ results, ranking });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = slotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  try {
    await upsertArtilheiroOfficialDraft(parsed.data);
    const results = await listArtilheiroOfficialResults();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const outcome = await applyArtilheiroOfficialResults(auth.admin.id);
    const [results, ranking] = await Promise.all([
      listArtilheiroOfficialResults(),
      buildArtilheiroRanking(50),
    ]);
    return NextResponse.json({ ok: true, ...outcome, results, ranking });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao aplicar resultado" },
      { status: 400 },
    );
  }
}
