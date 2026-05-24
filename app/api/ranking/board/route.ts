import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildLeaderboardDiarioForTicket, buildLeaderboardExtraForTicket, buildLeaderboardPrincipal } from "@/lib/ranking/leaderboard";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

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

  const mode = request.nextUrl.searchParams.get("mode")?.trim();
  const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim() || null;

  try {
    if (mode === "principal") {
      const { rows, meta } = await buildLeaderboardPrincipal();
      const rowsWithMe = rows.map((r) => ({ ...r, isMe: r.userId === userId }));
      return NextResponse.json({ rows: rowsWithMe, meta }, { headers: NO_STORE });
    }

    if (mode === "diario" && ticketId) {
      const pool = getPool();
      const { rows: ok } = await pool.query<{ ok: number }>(
        `SELECT 1 AS ok FROM tickets WHERE id = $1 AND user_id = $2 AND status = 'paid' AND ticket_type = 'daily' LIMIT 1`,
        [ticketId, userId]
      );
      if (!ok[0]) {
        return NextResponse.json({ error: "Cota nao encontrada" }, { status: 403 });
      }
      const { rows, meta } = await buildLeaderboardDiarioForTicket(ticketId);
      const rowsWithMe = rows.map((r) => ({ ...r, isMe: r.userId === userId }));
      return NextResponse.json({ rows: rowsWithMe, meta }, { headers: NO_STORE });
    }

    if (mode === "extra" && ticketId) {
      const pool = getPool();
      const { rows: ok } = await pool.query<{ ok: number }>(
        `SELECT 1 AS ok FROM tickets WHERE id = $1 AND user_id = $2 AND status = 'paid' AND ticket_type = 'extra' LIMIT 1`,
        [ticketId, userId]
      );
      if (!ok[0]) {
        return NextResponse.json({ error: "Cota nao encontrada" }, { status: 403 });
      }
      const { rows, meta } = await buildLeaderboardExtraForTicket(ticketId);
      const rowsWithMe = rows.map((r) => ({ ...r, isMe: r.userId === userId }));
      return NextResponse.json({ rows: rowsWithMe, meta }, { headers: NO_STORE });
    }

    return NextResponse.json(
      { error: "Use mode=principal ou mode=diario&ticketId= ou mode=extra&ticketId=" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[ranking/board]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
