import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authLog, oauthRequestSnapshot } from "@/lib/auth/oauth-console";
import { normalizeCpf } from "@/lib/auth/cpf";
import { verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie } from "@/lib/auth/session";
import { clearAdmin2faCookie } from "@/lib/admin/auth";
import { getPool } from "@/lib/db";
import { responseForDbError } from "@/lib/db-errors";

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
  const isEmail = trimmed.includes("@");

  try {
    const { rows } = await getPool().query<{
      id: string;
      email: string;
      name: string | null;
      role: string | null;
      password_hash: string | null;
    }>(
      `SELECT id, email, name, role, password_hash
       FROM users
       WHERE ${isEmail ? "lower(email) = lower($1)" : "cpf = $1"}
       LIMIT 1`,
      [isEmail ? trimmed : normalizeCpf(trimmed)]
    );
    const row = rows[0];

    if (!row || !row.password_hash) {
      return NextResponse.json({ error: "E-mail/CPF ou senha incorretos" }, { status: 401 });
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "E-mail/CPF ou senha incorretos" }, { status: 401 });
    }

    if (row.role !== "admin" && row.role !== "super_admin") {
      return NextResponse.json({ error: "Este usuário não possui acesso administrativo." }, { status: 403 });
    }

    const res = NextResponse.json({
      admin: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    });
    await attachSessionCookie(res, row.id, request);
    clearAdmin2faCookie(res);
    authLog("admin_password_login_ok", {
      userIdPrefix: `${row.id.slice(0, 8)}…`,
      role: row.role,
      ...oauthRequestSnapshot(request),
    });
    return res;
  } catch (error: unknown) {
    const db = responseForDbError(error);
    if (db) {
      console.error("[admin/login]", error);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[admin/login]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
