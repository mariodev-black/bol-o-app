import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { approveWithdrawalRequestById } from "@/lib/admin/withdrawals";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }
  const { id } = await params;
  const result = await approveWithdrawalRequestById(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, cartwaveTransactionId: result.cartwaveTransactionId });
}
