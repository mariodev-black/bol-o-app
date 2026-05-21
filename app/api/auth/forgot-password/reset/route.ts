import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithCode } from "@/lib/auth/password-reset";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    email: z.string().trim().email("E-mail inválido").max(200),
    code: z.string().min(6, "Código obrigatório").max(8),
    newPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(200),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "As senhas informadas não coincidem.",
        path: ["confirmPassword"],
      });
    }
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

  const result = await resetPasswordWithCode({
    email: parsed.data.email,
    code: parsed.data.code,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found" ? 404 : result.locked ? 423 : 400;
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

  return NextResponse.json({ ok: true as const });
}
