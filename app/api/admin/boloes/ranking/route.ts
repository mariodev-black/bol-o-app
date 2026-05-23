import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  ADMIN_BOLAO_RANKING_PAGE_SIZE,
  getAdminBolaoRankingPage,
  parseExtraBolaoScopeKey,
  type AdminBolaoRankingScope,
} from "@/lib/admin/sections";

export const runtime = "nodejs";

function parseScope(searchParams: URLSearchParams): AdminBolaoRankingScope | null {
  const type = searchParams.get("type")?.trim();
  if (type === "principal") return { type: "principal" };
  if (type === "daily") {
    const date = searchParams.get("date")?.trim();
    if (!date) return null;
    return { type: "daily", date };
  }
  if (type === "extra") {
    const key = searchParams.get("key")?.trim();
    if (!key || !parseExtraBolaoScopeKey(key)) return null;
    return { type: "extra", key };
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const scope = parseScope(searchParams);
  if (!scope) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limitRaw = Number.parseInt(
    searchParams.get("limit") ?? String(ADMIN_BOLAO_RANKING_PAGE_SIZE),
    10,
  );
  const limit = Number.isFinite(limitRaw) ? limitRaw : ADMIN_BOLAO_RANKING_PAGE_SIZE;

  try {
    const payload = await getAdminBolaoRankingPage(scope, { offset, limit });
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[admin/boloes/ranking]", e);
    return NextResponse.json({ error: "Erro ao carregar ranking" }, { status: 500 });
  }
}
