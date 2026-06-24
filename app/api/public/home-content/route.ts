import { NextResponse } from "next/server";
import {
  listHomeBanners,
  listHomeBolaoCards,
} from "@/lib/home-content/repository";

export const runtime = "nodejs";

/**
 * Conteúdo dinâmico da home (banners + cards de bolão) para os carrosséis.
 * Retorna SÓ os habilitados. Se as listas vierem vazias, o componente usa o
 * conteúdo estático de fallback — a home nunca fica sem banner.
 */
export async function GET() {
  try {
    const [banners, cards] = await Promise.all([
      listHomeBanners().catch(() => []),
      listHomeBolaoCards().catch(() => []),
    ]);
    return NextResponse.json(
      { banners, cards },
      // Cache curto: mudanças do admin aparecem em ~10s ao recarregar a home.
      { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=60" } },
    );
  } catch (e) {
    console.error("[public/home-content]", e);
    // Falha → listas vazias → componente cai no fallback estático.
    return NextResponse.json({ banners: [], cards: [] });
  }
}
