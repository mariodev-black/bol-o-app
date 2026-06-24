import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  deleteHomeBolaoCard,
  getHomeBolaoCardById,
  updateHomeBolaoCard,
} from "@/lib/home-content/repository";
import type { HomeBolaoCardInput } from "@/lib/home-content/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const item = await getHomeBolaoCardById(id);
  if (!item) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as HomeBolaoCardInput;
    const updated = await updateHomeBolaoCard(id, body);
    if (!updated) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });
    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar card";
    console.error("[admin/home-bolao-cards/:id] PUT", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ok = await deleteHomeBolaoCard(id);
  if (!ok) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
