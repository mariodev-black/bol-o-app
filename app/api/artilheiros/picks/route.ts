import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { ARTILHEIRO_PICK_SLOTS } from "@/lib/artilheiros/config";
import {
  artilheiroPicksComplete,
  listArtilheiroPicksForTicket,
  saveArtilheiroPick,
  saveArtilheiroPicksBatch,
} from "@/lib/artilheiros/picks";
import { isArtilheiroResultApplied, listArtilheiroOfficialResults } from "@/lib/artilheiros/results";
import { getArtilheiroTicketScore } from "@/lib/artilheiros/ranking";

export const runtime = "nodejs";

const saveSingleSchema = z
  .object({
    ticketId: z.string().uuid(),
    slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    apiPlayerId: z.number().int().positive(),
    apiTeamId: z.number().int().positive(),
  })
  .strict();

const saveBatchSchema = z
  .object({
    ticketId: z.string().uuid(),
    picks: z
      .array(
        z
          .object({
            slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            apiPlayerId: z.number().int().positive(),
            apiTeamId: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

const saveSchema = z.union([saveSingleSchema, saveBatchSchema]);

async function requireUser(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  return verifySessionToken(token).catch(() => null);
}

export async function GET(request: NextRequest) {
  const userId = await requireUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId obrigatorio" }, { status: 400 });
  }

  try {
    const [picks, results, score] = await Promise.all([
      listArtilheiroPicksForTicket(ticketId),
      listArtilheiroOfficialResults(),
      getArtilheiroTicketScore(ticketId),
    ]);
    const nextSlot = ARTILHEIRO_PICK_SLOTS.find(
      (s) => !picks.some((p) => p.slot === s),
    ) ?? null;

    return NextResponse.json({
      picks,
      complete: artilheiroPicksComplete(picks),
      nextSlot,
      resultsApplied: isArtilheiroResultApplied(results),
      score,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar palpites" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const results = await listArtilheiroOfficialResults();
  if (isArtilheiroResultApplied(results)) {
    return NextResponse.json({ error: "Bolao encerrado — palpites bloqueados" }, { status: 403 });
  }

  try {
    if ("picks" in parsed.data) {
      const picks = await saveArtilheiroPicksBatch({
        userId,
        ticketId: parsed.data.ticketId,
        picks: parsed.data.picks,
      });
      return NextResponse.json({
        picks,
        complete: artilheiroPicksComplete(picks),
        nextSlot: ARTILHEIRO_PICK_SLOTS.find((s) => !picks.some((p) => p.slot === s)) ?? null,
      });
    }

    const pick = await saveArtilheiroPick({
      userId,
      ticketId: parsed.data.ticketId,
      slot: parsed.data.slot,
      apiPlayerId: parsed.data.apiPlayerId,
      apiTeamId: parsed.data.apiTeamId,
    });
    const picks = await listArtilheiroPicksForTicket(parsed.data.ticketId);
    return NextResponse.json({
      pick,
      picks,
      complete: artilheiroPicksComplete(picks),
      nextSlot: ARTILHEIRO_PICK_SLOTS.find((s) => !picks.some((p) => p.slot === s)) ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar palpite";
    const status = msg.includes("nao encontrada") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
