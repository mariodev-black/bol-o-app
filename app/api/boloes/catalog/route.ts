import { NextResponse } from "next/server";
import { enrichBolaoDefinitionCatalog } from "@/lib/boloes/definitions/branding";
import { listBolaoDefinitionsForSale } from "@/lib/boloes/definitions/repository";

export const dynamic = "force-dynamic";

/** Catálogo público de bolões habilitados para venda (admin). */
export async function GET() {
  try {
    const definitions = await listBolaoDefinitionsForSale();
    const items = await enrichBolaoDefinitionCatalog(definitions);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[boloes/catalog] GET", error);
    return NextResponse.json({ error: "Falha ao carregar catálogo" }, { status: 500 });
  }
}
