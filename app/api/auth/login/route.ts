import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authLog, oauthRequestSnapshot } from "@/lib/auth/oauth-console";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
import { loginInputLooksLikeEmail } from "@/lib/auth/login-identifier";
import { verifyPassword } from "@/lib/auth/password";
import { enrichAuthUserWithSkaleFunnel } from "@/lib/auth/skale-funnel-auth";
import { attachSessionCookie } from "@/lib/auth/session";
import { syncSkaleFunnelCookies } from "@/lib/boloes/skale-funnel";
import { responseForDbError } from "@/lib/db-errors";
import { findUserByCpf, findUserByEmail, findUserById } from "@/lib/auth/users";

export const runtime = "nodejs";

const bodySchema = z.object({
  identifier: z.string().min(1, "Informe e-mail ou CPF"),
  password: z.string().min(1, "Informe a senha"),
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

  const { identifier, password } = parsed.data;
  const trimmed = identifier.trim();
  const isEmail = loginInputLooksLikeEmail(trimmed);

  if (!isEmail) {
    const cpf = normalizeCpf(trimmed);
    if (cpf.length !== 11 || !isValidCpf(cpf)) {
      return NextResponse.json({ error: "Informe um CPF válido com 11 dígitos." }, { status: 400 });
    }
  }

  let row: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    row = isEmail
      ? await findUserByEmail(trimmed.toLowerCase())
      : await findUserByCpf(normalizeCpf(trimmed));
  } catch (e: unknown) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[auth/login]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  if (!row || !row.password_hash) {
    return NextResponse.json({ error: "E-mail/CPF ou senha incorretos" }, { status: 401 });
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "E-mail/CPF ou senha incorretos" }, { status: 401 });
  }

  const user = await findUserById(row.id);
  if (!user) {
    return NextResponse.json({ error: "Conta inconsistente" }, { status: 500 });
  }
  const enriched = await enrichAuthUserWithSkaleFunnel(user, request);
  const res = NextResponse.json({ user: enriched });
  await attachSessionCookie(res, row.id, request);
  await syncSkaleFunnelCookies(res, request, row.id);
  authLog("password_login_ok", {
    userIdPrefix: `${row.id.slice(0, 8)}…`,
    ...oauthRequestSnapshot(request),
  });
  return res;
}
