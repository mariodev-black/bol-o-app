import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createDepositTransaction, parseTicketTypeOrThrow } from "@/lib/payments/transactions";
import {
  calculateProgressiveDiscountTotalCents,
  expectedPurchaseAmountCents,
  getExtraBolaoUnitCents,
  getTicketPriceCents,
} from "@/lib/payments/ticket-config";
import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  readCompetitionDisplayNamesFromDb,
  warmCompetitionMetadataCache,
} from "@/lib/competition-metadata-cache";

export const runtime = "nodejs";

const extraByChampionshipSchema = z
  .record(z.string(), z.number().int().min(0).max(20))
  .optional()
  .transform((rec) => {
    if (!rec) return {} as Record<number, number>;
    const allowed = new Set(parseExtraBolaoChampionshipIds());
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      const id = Number.parseInt(k, 10);
      if (!Number.isFinite(id) || !allowed.has(id)) continue;
      out[id] = v;
    }
    return out;
  });

const createCartSchema = z.object({
  generalQuantity: z.number().int().min(0).max(20),
  dailyQuantity: z.number().int().min(0).max(20),
  extraByChampionship: extraByChampionshipSchema,
  amountCents: z.number().int().positive().optional(),
});

const createLegacySchema = z.object({
  ticketType: z.enum(["general", "daily", "extra"]),
  quantity: z.number().int().min(1).max(20).default(1),
  extraChampionshipId: z.number().int().positive().optional(),
  amountCents: z.number().int().positive().optional(),
});

export async function GET() {
  const ids = parseExtraBolaoChampionshipIds();
  const unit = getExtraBolaoUnitCents();
  const labels = await readCompetitionDisplayNamesFromDb(ids).catch(() => ({} as Record<number, string>));
  void warmCompetitionMetadataCache(ids).catch(() => {});
  return NextResponse.json({
    prices: {
      general: getTicketPriceCents("general"),
      daily: getTicketPriceCents("daily"),
      extra: getExtraBolaoUnitCents(),
    },
    extraBoloes: ids.map((championshipId) => ({
      championshipId,
      unitCents: unit,
      ...(labels[championshipId] ? { displayName: labels[championshipId] } : {}),
    })),
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    return NextResponse.json({ error: "Sessao invalida" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const raw = json as Record<string, unknown>;
  const looksLikeCart =
    typeof raw.generalQuantity === "number" && typeof raw.dailyQuantity === "number";

  try {
    if (looksLikeCart) {
      const parsed = createCartSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
          { status: 400 }
        );
      }
      const { generalQuantity, dailyQuantity, extraByChampionship, amountCents } = parsed.data;
      const extra = extraByChampionship ?? {};
      if (generalQuantity + dailyQuantity + Object.values(extra).reduce((a, b) => a + b, 0) < 1) {
        return NextResponse.json({ error: "Selecione pelo menos um ticket" }, { status: 400 });
      }
      const expectedAmount = expectedPurchaseAmountCents(generalQuantity, dailyQuantity, extra);
      if (amountCents != null && amountCents !== expectedAmount) {
        return NextResponse.json({ error: "Valor do pedido invalido" }, { status: 400 });
      }
      const transaction = await createDepositTransaction({
        userId,
        generalQty: generalQuantity,
        dailyQty: dailyQuantity,
        extraByChampionship: extra,
        amountCentsOverride: expectedAmount,
      });
      return NextResponse.json({ transaction }, { status: 201 });
    }

    const parsed = createLegacySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos" }, { status: 400 });
    }

    const ticketType = parseTicketTypeOrThrow(parsed.data.ticketType);
    const quantity = parsed.data.quantity;
    if (ticketType === "extra") {
      const cid = parsed.data.extraChampionshipId;
      if (cid == null || !parseExtraBolaoChampionshipIds().includes(cid)) {
        return NextResponse.json({ error: "extraChampionshipId invalido para bolao extra" }, { status: 400 });
      }
      const expectedAmount = calculateProgressiveDiscountTotalCents(getExtraBolaoUnitCents(), quantity);
      if (parsed.data.amountCents != null && parsed.data.amountCents !== expectedAmount) {
        return NextResponse.json({ error: "Valor do pedido invalido" }, { status: 400 });
      }
      const transaction = await createDepositTransaction({
        userId,
        ticketType: "extra",
        quantity,
        extraChampionshipId: cid,
        amountCentsOverride: expectedAmount,
      });
      return NextResponse.json({ transaction }, { status: 201 });
    }

    const expectedAmount = calculateProgressiveDiscountTotalCents(getTicketPriceCents(ticketType), quantity);
    if (parsed.data.amountCents != null && parsed.data.amountCents !== expectedAmount) {
      return NextResponse.json({ error: "Valor do pedido invalido" }, { status: 400 });
    }
    const transaction = await createDepositTransaction({
      userId,
      ticketType,
      quantity,
      amountCentsOverride: expectedAmount,
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nao foi possivel criar a transacao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
