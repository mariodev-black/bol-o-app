import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  deleteHomeBanner,
  getHomeBannerById,
  updateHomeBanner,
} from "@/lib/home-content/repository";
import type { HomeBannerInput } from "@/lib/home-content/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const item = await getHomeBannerById(id);
  if (!item) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 });
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
    const body = (await request.json()) as HomeBannerInput;
    const updated = await updateHomeBanner(id, body);
    if (!updated) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 });
    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar banner";
    console.error("[admin/home-banners/:id] PUT", error);
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
  const ok = await deleteHomeBanner(id);
  if (!ok) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
