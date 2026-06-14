import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { listRecentPlayerPalpites } from "@/lib/ranking/player-palpites";

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

  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || null;
  const bolaoParam = request.nextUrl.searchParams.get("bolaoType");

  let bolaoType: "principal" | "diario" | "extra" = "principal";
  let extraChampionshipId: number | null = null;

  if (ticketId) {
    const pool = getPool();
    const { rows } = await pool.query<{
      ticket_type: string;
      extra_championship_id: number | null;
    }>(
      `SELECT ticket_type::text AS ticket_type, extra_championship_id
         FROM tickets
        WHERE id::text = $1 AND status IN ('paid', 'approved')
        LIMIT 1`,
      [ticketId],
    );
    const t = rows[0];
    if (!t) return NextResponse.json({ palpites: [] });
    if (t.ticket_type === "extra") {
      bolaoType = "extra";
      extraChampionshipId =
        t.extra_championship_id != null ? Number(t.extra_championship_id) : null;
    } else if (t.ticket_type === "daily") {
      bolaoType = "diario";
    } else {
      bolaoType = "principal";
    }
  } else if (bolaoParam === "diario") {
    bolaoType = "diario";
  } else if (bolaoParam === "extra") {
    bolaoType = "extra";
    const cid = request.nextUrl.searchParams.get("championshipId");
    extraChampionshipId = cid != null ? Number(cid) : null;
  } else {
    bolaoType = "principal";
  }

  const palpites = await listRecentPlayerPalpites({
    bolaoType,
    extraChampionshipId,
    limit: 80,
  });

  return NextResponse.json({ palpites });
}
