import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createWalletPurchaseForDefinition } from "@/lib/payments/transactions";
import { WalletInsufficientFundsError } from "@/lib/wallet/ledger";
import { isWalletCheckoutEnabled } from "@/lib/ticket-shop-flags";
import { responseForDbError } from "@/lib/db-errors";

export const runtime = "nodejs";

const purchaseSchema = z.object({
  bolaoId: z.string().trim().uuid(),
  quantidade: z.number().int().min(1).max(999),
  idempotencyKey: z.string().trim().max(128).optional(),
});

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
  if (!userId) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  if (!isWalletCheckoutEnabled()) {
    return NextResponse.json(
      { error: "Pagamento com saldo indisponível no momento." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = purchaseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 },
    );
  }

  try {
    const purchase = await createWalletPurchaseForDefinition({
      userId,
      bolaoDefinitionId: parsed.data.bolaoId,
      quantity: parsed.data.quantidade,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json(
      {
        transactionId: purchase.transactionId,
        amountCents: purchase.amountCents,
        ticketIds: purchase.ticketIds,
        balanceCents: purchase.balanceCents,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof WalletInsufficientFundsError) {
      return NextResponse.json(
        {
          error: "Saldo insuficiente para concluir a compra.",
          code: e.code,
          availableCents: e.availableCents,
          requestedCents: e.requestedCents,
        },
        { status: 402 },
      );
    }

    const db = responseForDbError(e);
    if (db) {
      return NextResponse.json({ error: db.error }, { status: db.status });
    }

    const message = e instanceof Error ? e.message : "Nao foi possivel concluir a compra";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
