import { getCurrentAdminUser, hasValidAdmin2fa } from "@/lib/admin/auth";
import { getPool } from "@/lib/db";
import { isUuidString } from "@/lib/referrals/withdrawGuards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  affiliateMode: z.enum(["standard", "influencer"]),
  influencerCpaBps: z.number().int().min(0).max(10000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!admin.twoFactorEnabled || !(await hasValidAdmin2fa(admin.id))) {
    return NextResponse.json(
      { error: "2FA admin obrigatorio. Abra /admin/2fa neste navegador e conclua a verificacao." },
      { status: 403 }
    );
  }
  if (admin.role !== "super_admin") {
    return NextResponse.json({ error: "Apenas super admin pode alterar modo influencer" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Configuracao influencer invalida" }, { status: 400 });
  }

  const { userId } = await params;
  const uid = userId.trim();
  if (!isUuidString(uid)) {
    return NextResponse.json({ error: "Usuario invalido" }, { status: 400 });
  }

  const cpaBps = parsed.data.affiliateMode === "influencer" ? parsed.data.influencerCpaBps : 0;
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    affiliate_mode: string;
    influencer_cpa_bps: number;
  }>(
    `UPDATE users
     SET affiliate_mode = $2,
         influencer_cpa_bps = $3,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING id, affiliate_mode, influencer_cpa_bps`,
    [uid, parsed.data.affiliateMode, cpaBps]
  );
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    affiliateMode: row.affiliate_mode === "influencer" ? "influencer" : "standard",
    influencerCpaBps: Number(row.influencer_cpa_bps ?? 0),
  });
}
