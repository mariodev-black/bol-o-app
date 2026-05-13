import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { completeGoogleProfile } from "@/lib/auth/users";
import { isValidBrazilNationalDigits, isReasonableNationalDigits } from "@/lib/auth/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  cpf: z.string().min(1, "Informe o CPF"),
  /** Opcional; se enviado, validamos formato (Brasil ou internacional). */
  phone: z.string().max(44).optional().nullable(),
  fullName: z.string().max(120).optional().nullable(),
});

function normalizeOptionalPhone(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new Error("Telefone incompleto");
  }
  if (t.startsWith("+55") || (!t.startsWith("+") && digits.length <= 11)) {
    const national = t.startsWith("+55") ? digits.replace(/^55/, "").slice(-11) : digits.slice(-11);
    if (national.length === 10 || national.length === 11) {
      if (!isValidBrazilNationalDigits(national)) {
        throw new Error("Telefone celular/fixo inválido (Brasil)");
      }
    }
  } else if (!isReasonableNationalDigits(digits)) {
    throw new Error("Telefone inválido");
  }
  return t.slice(0, 40);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  let userId: string;
  try {
    userId = (await verifySessionToken(token)) ?? "";
  } catch {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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

  let phoneNorm: string | null = null;
  try {
    phoneNorm = normalizeOptionalPhone(parsed.data.phone ?? null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Telefone inválido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const result = await completeGoogleProfile({
    userId,
    cpf: parsed.data.cpf,
    phone: phoneNorm,
    fullName: parsed.data.fullName ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ user: result.user });
}
