import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { createHomeBanner, listHomeBanners } from "@/lib/home-content/repository";
import type { HomeBannerInput } from "@/lib/home-content/types";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const items = await listHomeBanners({ includeDisabled: true });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[admin/home-banners] GET", error);
    return NextResponse.json({ error: "Falha ao listar banners" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as HomeBannerInput;
    const created = await createHomeBanner(body);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar banner";
    console.error("[admin/home-banners] POST", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
