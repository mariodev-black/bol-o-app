import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  homeImageUploadErrorResponse,
  parseHomeImageUpload,
} from "@/lib/home-content/image-upload";
import {
  bolaoDefinitionMediaPublicUrl,
  saveBolaoDefinitionMedia,
} from "@/lib/boloes/definitions/media";

export const runtime = "nodejs";

/** Upload de logo/banner para bolão (antes ou depois de criar a definição). */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });
  }

  try {
    const { buffer, mime } = await parseHomeImageUpload(form);
    const id = await saveBolaoDefinitionMedia(buffer, mime);
    const url = bolaoDefinitionMediaPublicUrl(id);
    return NextResponse.json({ id, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const known = homeImageUploadErrorResponse(msg);
    if (known) return NextResponse.json({ error: known.error }, { status: known.status });
    console.error("[admin/boloes/definitions/media]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
