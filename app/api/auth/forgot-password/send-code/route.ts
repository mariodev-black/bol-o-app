import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetCode } from "@/lib/auth/password-reset";
import { isResendConfigured } from "@/lib/email/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(200),
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
    const first = parsed.error.issues[0]?.message ?? "E-mail inválido";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const result = await sendPasswordResetCode(parsed.data.email);
  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.retryAfterSeconds
          ? 429
          : 400;
    return NextResponse.json(
      {
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
        reason: result.reason,
      },
      { status },
    );
  }

  const devHint =
    process.env.NODE_ENV !== "production" && !isResendConfigured()
      ? { devMode: true as const }
      : {};

  return NextResponse.json({
    sent: true,
    emailSent: true,
    message: "Código enviado por e-mail.",
    ...devHint,
  });
}
