import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
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
  // Opcionais — usados para enriquecer o lead no SellFlux WhatsApp webhook.
  // Não são (re)validados aqui porque já passam por validação de UX no client;
  // o registro final em `/api/auth/register` faz a validação canônica.
  name: z.string().trim().min(1).max(160).optional(),
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

  const result = await sendRegistrationSmsCode({
    phoneE164,
    cpf,
    name: parsed.data.name ?? null,
    email: parsed.data.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryAfterSeconds: result.retryAfterSeconds },
      { status: result.retryAfterSeconds ? 429 : 400 },
    );
  }

  // Em dev/staging, se o webhook do WhatsApp não estiver configurado, o código
  // só aparece no console — sinalizamos via `devMode` para o front mostrar UI
  // amigável (sem cobrar o usuário a inserir o código de um SMS que não chegou).
  const devHint =
    process.env.NODE_ENV !== "production" &&
    !process.env.REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim()
      ? { devMode: true as const }
      : {};

  return NextResponse.json({ sent: true, ...devHint });
}
