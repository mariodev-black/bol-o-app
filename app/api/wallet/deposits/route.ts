import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { createWalletDeposit } from "@/lib/wallet/deposit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { amountCents?: unknown };
  try {
    body = (await request.json()) as { amountCents?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const amountCents = Number(body.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  try {
    const deposit = await createWalletDeposit({ userId, amountCents: Math.trunc(amountCents) });
    return NextResponse.json({ deposit });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao gerar depósito";
    console.error("[wallet/deposits]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
