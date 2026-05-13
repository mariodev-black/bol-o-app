import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { computePalpitesResumo } from "@/lib/palpites/resumo-compute";
import { buildLeaderboardDiarioForTicket, buildLeaderboardPrincipal } from "@/lib/ranking/leaderboard";
import { buildRankingScopes } from "@/lib/ranking/scopes";
import { getPool } from "@/lib/db";

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

  const defaultRequested = request.nextUrl.searchParams.get("default")?.trim() || null;

  try {
    const { scopes, defaultKey, hasAnyTicket } = await buildRankingScopes(userId, { defaultRequested });
    if (!hasAnyTicket || !defaultKey) {
      return NextResponse.json({
        scopes,
        defaultKey,
        hasAnyTicket,
        initialBoard: null,
        initialResumo: null,
      });
    }

    const opt = scopes.find((s) => s.key === defaultKey);
    if (!opt) {
      return NextResponse.json({
        scopes,
        defaultKey,
        hasAnyTicket,
        initialBoard: null,
        initialResumo: null,
      });
    }

    const boardPromise =
      opt.mode === "principal"
        ? buildLeaderboardPrincipal()
        : (async () => {
            const pool = getPool();
            const { rows: ok } = await pool.query<{ ok: number }>(
              `SELECT 1 AS ok FROM tickets WHERE id = $1 AND user_id = $2 AND status = 'paid' AND ticket_type = 'daily' LIMIT 1`,
              [opt.ticketId ?? "", userId]
            );
            if (!ok[0]) {
              return {
                rows: [],
                meta: {
                  participantCount: 0,
                  revenueCents: 0,
                  poolCentsApprox: 0,
                  nextPalpiteLockMs: null as number | null,
                  approxPremiados: 0,
                  hasResultedMatchesInPool: false,
                },
              };
            }
            return buildLeaderboardDiarioForTicket(opt.ticketId!);
          })();

    const resumoPromise =
      opt.mode === "principal"
        ? computePalpitesResumo(userId, { bolaoType: "principal" })
        : computePalpitesResumo(userId, { ticketId: opt.ticketId ?? undefined });

    const [{ rows, meta }, initialResumo] = await Promise.all([boardPromise, resumoPromise]);

    const rowsWithMe = rows.map((r) => ({ ...r, isMe: r.userId === userId }));

    return NextResponse.json({
      scopes,
      defaultKey,
      hasAnyTicket,
      initialBoard: { scopeKey: defaultKey, rows: rowsWithMe, meta },
      initialResumo,
    });
  } catch (e) {
    console.error("[ranking/bootstrap]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
