import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { loadBoloesData } from "@/app/(authenticated)/boloes/page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const data = await loadBoloesData(userId);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[boloes/screen]", error);
    return NextResponse.json({ data: null }, { status: 200 });
  }
}
