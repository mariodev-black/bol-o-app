import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  createHomeBolaoCard,
  listHomeBolaoCards,
} from "@/lib/home-content/repository";
import type { HomeBolaoCardInput } from "@/lib/home-content/types";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const items = await listHomeBolaoCards({ includeDisabled: true });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[admin/home-bolao-cards] GET", error);
    return NextResponse.json({ error: "Falha ao listar cards" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as HomeBolaoCardInput;
    const created = await createHomeBolaoCard(body);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar card";
    console.error("[admin/home-bolao-cards] POST", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
