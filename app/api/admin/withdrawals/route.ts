import { NextResponse } from "next/server";
import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { listPendingWithdrawalsForAdmin } from "@/lib/admin/withdrawals";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }
  try {
    const items = await listPendingWithdrawalsForAdmin();
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[admin/withdrawals]", e);
    return NextResponse.json({ error: "Erro ao listar saques" }, { status: 500 });
  }
}
