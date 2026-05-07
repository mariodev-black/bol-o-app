import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { getCurrentAdminUser, setAdmin2faCookie } from "@/lib/admin/auth";
import { verifyTotpCode } from "@/lib/admin/totp";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().min(6).max(12),
});

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: "Admin nao autorizado" }, { status: 403 });
  if (!admin.twoFactorSecret) return NextResponse.json({ error: "2FA ainda nao configurado" }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Codigo invalido" }, { status: 400 });

  if (!verifyTotpCode(admin.twoFactorSecret, parsed.data.code)) {
    return NextResponse.json({ error: "Codigo 2FA incorreto" }, { status: 401 });
  }

  if (!admin.twoFactorEnabled) {
    await getPool().query(
      `UPDATE users
       SET admin_2fa_enabled = true,
           admin_2fa_enabled_at = COALESCE(admin_2fa_enabled_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [admin.id]
    );
  }

  const res = NextResponse.json({ ok: true });
  await setAdmin2faCookie(res, admin.id);
  return res;
}
