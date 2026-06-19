import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { duplicateBolaoDefinition } from "@/lib/boloes/definitions/repository";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const item = await duplicateBolaoDefinition(id);
    if (!item) {
      return NextResponse.json({ error: "Bolão não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao duplicar";
    console.error("[admin/boloes/definitions/duplicate] POST", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
