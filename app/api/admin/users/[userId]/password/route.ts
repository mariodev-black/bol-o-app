import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { hashPassword } from "@/lib/auth/password";
import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json({ error: "Admin nao autorizado" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Senha invalida" }, { status: 400 });
  }

  const { userId } = await params;
  const passwordHash = await hashPassword(parsed.data.password);
  const result = await getPool().query(
    `UPDATE users
     SET password_hash = $2,
         updated_at = now()
     WHERE id::text = $1::text`,
    [userId, passwordHash]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
