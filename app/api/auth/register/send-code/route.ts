import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
import { fetchCpfFromBrasilApi } from "@/lib/auth/cpf-brasil-api";
import { isValidBrazilNationalDigits } from "@/lib/auth/phone";
import {
  normalizeRegistrationPhoneE164,
  sendRegistrationSmsCode,
} from "@/lib/auth/registration-sms";
import { findUserByCpf } from "@/lib/auth/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  cpf: z.string().min(1),
  phone: z.string().min(8).max(40),
  // Opcional — só o email é repassado do client (já validado no step 2).
  // O NOME REAL é resolvido server-side via `fetchCpfFromBrasilApi` para não
  // confiar em payload de UI (LGPD: o cliente recebe só o nome mascarado).
  email: z.string().trim().email().max(200).optional(),
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
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }

  const cpf = normalizeCpf(parsed.data.cpf);
  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  const phoneDigits = parsed.data.phone.replace(/\D/g, "");
  if (!isValidBrazilNationalDigits(phoneDigits)) {
    return NextResponse.json({ error: "Informe um celular válido com DDD." }, { status: 400 });
  }

  const phoneE164 = normalizeRegistrationPhoneE164(phoneDigits);
  if (!phoneE164) {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }

  try {
    const existing = await findUserByCpf(cpf);
    if (existing) {
      return NextResponse.json({ error: "Este CPF já está cadastrado." }, { status: 409 });
    }
  } catch (e) {
    console.error("[auth/register/send-code] cpf check", e);
    return NextResponse.json({ error: "Erro ao validar CPF" }, { status: 500 });
  }

  // Resolve o NOME REAL server-side (LGPD: cliente nunca recebe nome completo).
  // Falha silenciosa: se o lookup quebrar, mandamos sem nome — o webhook ainda
  // identifica o lead pelo phone/email. Não bloqueamos o envio do código.
  let realName: string | null = null;
  try {
    const lookup = await fetchCpfFromBrasilApi(cpf);
    if (lookup.ok && lookup.data.nome && lookup.data.nome.trim().length >= 2) {
      realName = lookup.data.nome.trim();
    }
  } catch (e) {
    console.warn("[auth/register/send-code] cpf-name lookup falhou; segue sem nome", e);
  }

  const result = await sendRegistrationSmsCode({
    phoneE164,
    cpf,
    name: realName,
    email: parsed.data.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryAfterSeconds: result.retryAfterSeconds },
      { status: result.retryAfterSeconds ? 429 : 400 },
    );
  }

  // Em dev/staging, sem webhook SellFlux o código aparece no log — `devMode` avisa o front.
  const devHint =
    process.env.NODE_ENV !== "production" &&
    !process.env.REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim()
      ? { devMode: true as const }
      : {};

  return NextResponse.json({ sent: true, ...devHint });
}
