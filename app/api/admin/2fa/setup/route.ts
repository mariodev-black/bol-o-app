import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getCurrentAdminUser } from "@/lib/admin/auth";
import { buildOtpAuthUrl, generateTotpSecret } from "@/lib/admin/totp";

export const runtime = "nodejs";

export async function POST() {
  const admin = await getCurrentAdminUser();
  if (!admin) return NextResponse.json({ error: "Admin nao autorizado" }, { status: 403 });

  const secret = admin.twoFactorSecret ?? generateTotpSecret();
  if (!admin.twoFactorSecret) {
    await getPool().query(
      `UPDATE users SET admin_2fa_secret = $2, updated_at = now() WHERE id = $1`,
      [admin.id, secret]
    );
  }

  return NextResponse.json({
    secret,
    otpauthUrl: buildOtpAuthUrl({ secret, email: admin.email }),
    enabled: admin.twoFactorEnabled,
  });
}
