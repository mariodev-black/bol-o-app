import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createDepositTransaction, parseTicketTypeOrThrow } from "@/lib/payments/transactions";
import {
  expectedPurchaseAmountCents,
  getExtraTicketPriceCents,
  getTicketPriceCents,
} from "@/lib/payments/ticket-config";

export const runtime = "nodejs";

const createCartSchema = z.object({
  generalQuantity: z.number().int().min(0).max(20),
  dailyQuantity: z.number().int().min(0).max(20),
  amountCents: z.number().int().positive().optional(),
});

const createLegacySchema = z.object({
  ticketType: z.enum(["general", "daily"]),
  quantity: z.number().int().min(1).max(20).default(1),
  amountCents: z.number().int().positive().optional(),
});

export async function GET() {
  return NextResponse.json({
    prices: {
      general: getTicketPriceCents("general"),
      daily: getTicketPriceCents("daily"),
      extra: getExtraTicketPriceCents(),
    },
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
      const { generalQuantity, dailyQuantity, amountCents } = parsed.data;
      if (generalQuantity + dailyQuantity < 1) {
        return NextResponse.json({ error: "Selecione pelo menos um ticket" }, { status: 400 });
      }
      const expectedAmount = expectedPurchaseAmountCents(generalQuantity, dailyQuantity);
      if (amountCents != null && amountCents !== expectedAmount) {
        return NextResponse.json({ error: "Valor do pedido invalido" }, { status: 400 });
      }
      const transaction = await createDepositTransaction({
        userId,
        generalQty: generalQuantity,
        dailyQty: dailyQuantity,
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
    const expectedAmount =
      ticketType === "general" && quantity === 2
        ? getTicketPriceCents("general") + getExtraTicketPriceCents()
        : getTicketPriceCents(ticketType) * quantity;
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
