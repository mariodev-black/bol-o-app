import { NextResponse } from "next/server";
import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { runCartwaveDebugReport } from "@/lib/payments/cartwave/debug";

export const runtime = "nodejs";

/** Admin: diagnostico Cartwave (auth, env mascarado, CloudFront/WAF). */
export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  try {
    const report = await runCartwaveDebugReport();
    return NextResponse.json(report);
  } catch (e) {
    console.error("[admin/cartwave/debug]", e);
    return NextResponse.json({ error: "Erro ao diagnosticar Cartwave" }, { status: 500 });
  }
}
