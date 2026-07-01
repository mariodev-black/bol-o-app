import { NextResponse } from "next/server";
import { buildBolaoCatalogSections } from "@/lib/boloes/definitions/catalog";

export const dynamic = "force-dynamic";

/** Catálogo público com seções: próximos, disponíveis, encerrados. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get("section");
    const sections = await buildBolaoCatalogSections();
    if (section === "upcoming") {
      return NextResponse.json({ items: sections.upcoming });
    }
    if (section === "available") {
      return NextResponse.json({ items: sections.available });
    }
    if (section === "closed") {
      return NextResponse.json({ items: sections.closed });
    }
    return NextResponse.json(sections);
  } catch (error) {
    console.error("[boloes/catalog] GET", error);
    return NextResponse.json({ error: "Falha ao carregar catálogo" }, { status: 500 });
  }
}
