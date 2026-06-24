import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { reorderHomeBolaoCards } from "@/lib/home-content/repository";

export async function PUT(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Lista de ids inválida" }, { status: 400 });
    }
    await reorderHomeBolaoCards(ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/home-bolao-cards/reorder] PUT", error);
    return NextResponse.json({ error: "Falha ao reordenar" }, { status: 500 });
  }
}
