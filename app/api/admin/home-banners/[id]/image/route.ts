import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { getHomeBannerById, setHomeBannerImage } from "@/lib/home-content/repository";
import {
  homeImageUploadErrorResponse,
  parseHomeImageUpload,
} from "@/lib/home-content/image-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });
  }

  try {
    const { buffer, mime } = await parseHomeImageUpload(form);
    const ok = await setHomeBannerImage(id, buffer, mime);
    if (!ok) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 });
    const item = await getHomeBannerById(id);
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const known = homeImageUploadErrorResponse(msg);
    if (known) return NextResponse.json({ error: known.error }, { status: known.status });
    console.error("[admin/home-banners/:id/image]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
