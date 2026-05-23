import { NextResponse } from "next/server";
import { getCurrentAdminUser, hasValidAdmin2fa, type AdminUser } from "@/lib/admin/auth";

export type AdminApiAuthResult =
  | { ok: true; admin: AdminUser }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<AdminApiAuthResult> {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nao autorizado" }, { status: 403 }),
    };
  }
  return { ok: true, admin };
}
