import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createDepositTransaction, parseTicketTypeOrThrow } from "@/lib/payments/transactions";
import { getTicketPriceCents } from "@/lib/payments/ticket-config";

export const runtime = "nodejs";

const createSchema = z.object({
  ticketType: z.enum(["general", "daily"]),
  quantity: z.number().int().min(1).max(20).default(1),
});

export async function GET() {
  return NextResponse.json({
    prices: {
      general: getTicketPriceCents("general"),
      daily: getTicketPriceCents("daily"),
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos" }, { status: 400 });
  }

  try {
    const ticketType = parseTicketTypeOrThrow(parsed.data.ticketType);
    const quantity = parsed.data.quantity;
    const transaction = await createDepositTransaction({ userId, ticketType, quantity });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nao foi possivel criar a transacao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
