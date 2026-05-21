import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPasswordResetCode } from "@/lib/auth/password-reset";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(200),
  code: z.string().min(6, "Código obrigatório").max(8),
});

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const result = await verifyPasswordResetCode({
    email: parsed.data.email,
    code: parsed.data.code,
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.locked ? 423 : 400;
    return NextResponse.json(
      {
        error: result.error,
        attemptsRemaining: result.attemptsRemaining,
        locked: result.locked ?? false,
        reason: result.reason,
      },
      { status },
    );
  }

  return NextResponse.json({ verified: true as const });
}
