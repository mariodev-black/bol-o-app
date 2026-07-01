import { NextResponse } from "next/server";
import { readBolaoDefinitionMedia } from "@/lib/boloes/definitions/media";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const img = await readBolaoDefinitionMedia(id);
    if (!img) {
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(img.data), {
      headers: {
        "Content-Type": img.mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    console.error("[public/bolao-definition-media]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
