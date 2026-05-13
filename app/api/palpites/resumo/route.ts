import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { computePalpitesResumo } from "@/lib/palpites/resumo-compute";

export const runtime = "nodejs";

async function authUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || undefined;
  const bolaoParam = request.nextUrl.searchParams.get("bolaoType");

  let bolaoType: "principal" | "diario" | "extra" | undefined;
  if (ticketId) {
    bolaoType = undefined;
  } else if (bolaoParam === "diario") {
    bolaoType = "diario";
  } else if (bolaoParam === "principal") {
    bolaoType = "principal";
  } else if (bolaoParam === "extra") {
    bolaoType = "extra";
  } else {
    bolaoType = undefined;
  }

  const resumo = await computePalpitesResumo(userId, { ticketId, bolaoType });
  return NextResponse.json({ resumo });
}
