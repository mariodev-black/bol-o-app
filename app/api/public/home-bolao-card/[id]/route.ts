import { NextResponse } from "next/server";
import { readHomeBolaoCardImage } from "@/lib/home-content/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const img = await readHomeBolaoCardImage(id);
    if (!img) {
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(img.data), {
      headers: {
        "Content-Type": img.mime,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    console.error("[public/home-bolao-card]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
