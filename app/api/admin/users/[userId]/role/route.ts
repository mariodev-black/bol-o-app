import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  role: z.enum(["user", "admin", "super_admin"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentAdminUser();
  if (
    !admin ||
    admin.role !== "super_admin" ||
    !admin.twoFactorEnabled ||
    !(await hasValidAdmin2fa(admin.id))
  ) {
    return NextResponse.json({ error: "Apenas super admin pode alterar role de usuario" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Role invalido" }, { status: 400 });
  }

  const { userId } = await params;
  const pool = getPool();
  const current = await pool.query<{ id: string; role: string | null }>(
    `SELECT id, role FROM users WHERE id::text = $1::text LIMIT 1`,
    [userId]
  );
  const target = current.rows[0];
  if (!target) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });

  if (target.role === "super_admin" && parsed.data.role !== "super_admin") {
    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE role = 'super_admin'`
    );
    if (Number(count.rows[0]?.count ?? 0) <= 1) {
      return NextResponse.json({ error: "Nao e possivel remover o ultimo super admin" }, { status: 400 });
    }
  }

  await pool.query(
    `UPDATE users
     SET role = $2,
         updated_at = now()
     WHERE id::text = $1::text`,
    [userId, parsed.data.role]
  );

  return NextResponse.json({ ok: true, role: parsed.data.role });
}
