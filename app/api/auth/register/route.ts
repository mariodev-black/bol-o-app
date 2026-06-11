import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authLog, oauthRequestSnapshot } from "@/lib/auth/oauth-console";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
import { hashPassword } from "@/lib/auth/password";
import { enrichAuthUserWithSkaleFunnel } from "@/lib/auth/skale-funnel-auth";
import { attachSessionCookie } from "@/lib/auth/session";
import { syncSkaleFunnelCookies } from "@/lib/boloes/skale-funnel";
import { responseForDbError } from "@/lib/db-errors";
import { isValidBrazilNationalDigits, normalizeBrazilPhoneE164 } from "@/lib/auth/phone";
import { createUserWithPassword, getRegistrationConflicts } from "@/lib/auth/users";
import { postRegistrationCompletedWebhook } from "@/lib/auth/registration-complete-webhook";
import { sendWelcomeEmail } from "@/lib/email/registration";
import { ensureWelcomeNotification } from "@/lib/notifications/user-notifications";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120, "Nome muito longo"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().min(1, "CPF obrigatório"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(200),
  phone: z.string().min(8, "Telefone obrigatório").max(40),
  /** Código de indicação de outro usuário (opcional). */
  referralCode: z.string().max(12).optional().nullable(),
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, { message: "Aceite os termos para continuar" }),
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

  const email = parsed.data.email.trim();
  const {
    name: nameRaw,
    password,
    phone,
    acceptTerms: _acceptTerms,
    referralCode: referralCodeRaw,
  } = parsed.data;
  const inviteCodeEntered =
    typeof referralCodeRaw === "string" && referralCodeRaw.trim().length > 0
      ? referralCodeRaw.trim()
      : null;
  const cpf = normalizeCpf(parsed.data.cpf);
  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  const fullName = nameRaw.trim();

  const phoneDigits = phone.replace(/\D/g, "");
  if (!isValidBrazilNationalDigits(phoneDigits)) {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }
  const phoneE164 = normalizeBrazilPhoneE164(phoneDigits);
  if (!phoneE164) {
    return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
  }

  try {
    const conflicts = await getRegistrationConflicts(email, cpf);
    if (conflicts.emailTaken && conflicts.cpfTaken) {
      return NextResponse.json(
        { error: "Este e-mail e este CPF já estão cadastrados. Use outro e-mail ou faça login." },
        { status: 409 }
      );
    }
    if (conflicts.emailTaken) {
      return NextResponse.json(
        {
          error:
            "Este e-mail já está cadastrado. O CPF pode ser novo, mas o e-mail precisa ser outro — ou entre com esse e-mail em “Login”.",
        },
        { status: 409 }
      );
    }
    if (conflicts.cpfTaken) {
      return NextResponse.json(
        { error: "Este CPF já está cadastrado. Use outro CPF ou faça login." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { user, inviteInvalid } = await createUserWithPassword({
      email,
      cpf,
      passwordHash,
      name: fullName,
      phone: phoneE164,
      inviteCodeEntered,
    });
    const payload: { user: Awaited<ReturnType<typeof enrichAuthUserWithSkaleFunnel>>; referralWarning?: string } = {
      user: await enrichAuthUserWithSkaleFunnel(user, request),
    };
    if (inviteInvalid && inviteCodeEntered) {
      payload.referralWarning =
        "Código de indicação não encontrado. Sua conta foi criada; você pode compartilhar o seu código em Indique.";
    }
    const res = NextResponse.json(payload);
    await attachSessionCookie(res, user.id, request);
    await syncSkaleFunnelCookies(res, request, user.id);
    void sendWelcomeEmail({ email, name: fullName, userId: user.id }).catch((err) => {
      console.error("[auth/register] welcome email", err);
    });
    void ensureWelcomeNotification(user.id, fullName).catch((err) => {
      console.error("[auth/register] welcome notification", err);
    });
    void postRegistrationCompletedWebhook({
      name: fullName,
      email,
      phoneE164,
    }).catch((err) => {
      console.error("[auth/register] registration complete webhook", err);
    });
    authLog("register_ok", {
      userIdPrefix: `${user.id.slice(0, 8)}…`,
      ...oauthRequestSnapshot(request),
    });
    return res;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      const detail = (e as { detail?: string }).detail ?? "";
      let msg = "Este dado já está cadastrado.";
      if (detail.includes("(email)=") || detail.includes("Key (email)")) {
        msg =
          "Este e-mail já está cadastrado. Use outro e-mail ou faça login.";
      } else if (detail.includes("(cpf)=") || detail.includes("Key (cpf)")) {
        msg = "Este CPF já está cadastrado. Use outro CPF ou faça login.";
      } else if (detail.includes("(referral_code)=") || detail.includes("Key (referral_code)")) {
        msg = "Conflito ao gerar código de indicação. Tente criar a conta novamente.";
      }
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    const db = responseForDbError(e);
    if (db) {
      console.error("[auth/register]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[auth/register]", e);
    return NextResponse.json({ error: "Não foi possível criar a conta" }, { status: 500 });
  }
}
