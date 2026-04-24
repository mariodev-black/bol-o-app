import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createAffiliateWithdrawalRequest, minAffiliateWithdrawalCents } from "@/lib/referrals/withdraw";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  pixKeyType: z.enum(["cpf", "email", "phone", "random"]),
  pixKey: z.string().trim().min(3).max(200),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  let userId: string;
  try {
    userId = (await verifySessionToken(token)) ?? "";
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
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos" }, { status: 400 });
  }

  try {
    const { id } = await createAffiliateWithdrawalRequest({
      userId,
      amountCents: parsed.data.amountCents,
      pixKeyType: parsed.data.pixKeyType,
      pixKey: parsed.data.pixKey,
    });
    return NextResponse.json({
      ok: true,
      requestId: id,
      minWithdrawalCents: minAffiliateWithdrawalCents(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao solicitar saque";
    const status = msg.includes("minimo") || msg.includes("Saldo") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
