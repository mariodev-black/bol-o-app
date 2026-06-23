import { NextRequest, NextResponse } from "next/server";
import { listAdminPredictions } from "@/lib/admin/sections";
import { requireAdminApi } from "@/lib/admin/require-admin-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "500");
    const offsetRaw = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 500;
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

    const predictions = await listAdminPredictions({
      search: q || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ predictions, count: predictions.length, q });
  } catch (e) {
    console.error("[admin/palpites]", e);
    return NextResponse.json({ error: "Erro ao listar palpites" }, { status: 500 });
  }
}
