import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { listWithdrawalsForAdmin } from "@/lib/admin/withdrawals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }
  try {
    const raw = request.nextUrl.searchParams.get("status");
    const status =
      raw === "pending" ||
      raw === "processing" ||
      raw === "paid" ||
      raw === "rejected" ||
      raw === "failed" ||
      raw === "refunded" ||
      raw === "all"
        ? raw
        : "pending";
    const rows = await listWithdrawalsForAdmin(status);
    return NextResponse.json({ rows, items: rows });
  } catch (e) {
    console.error("[admin/withdrawals]", e);
    return NextResponse.json({ error: "Erro ao listar saques" }, { status: 500 });
  }
}
