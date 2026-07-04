import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { getPool } from "@/lib/db";
import { resolvePaidTicketRankingPositions } from "@/lib/ranking/leaderboard";
import { buildArtilheiroRanking } from "@/lib/artilheiros/ranking";
import { isArtilheiroResultApplied, listArtilheiroOfficialResults } from "@/lib/artilheiros/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketPosition = { position: number | null; points: number };

/**
 * Posições de ranking por cota — carregado sob demanda pelo client (`/boloes`),
 * fora do caminho crítico do SSR. Cada board é pesado (materializa todo o
 * ranking) e cacheado por `resolvePaidTicketRankingPositions`, então mantemos
 * essa computação fora do first paint da página.
 */
export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      ticket_type: "general" | "daily" | "extra" | "artilheiros";
      bolao_definition_id: string | null;
    }>(
      `SELECT id::text AS id, ticket_type, bolao_definition_id::text AS bolao_definition_id
         FROM tickets
        WHERE user_id = $1 AND status = 'paid'`,
      [userId],
    );

    const positions: Record<string, TicketPosition> = {};

    const scopedTickets = rows
      .filter((r) => r.ticket_type !== "artilheiros")
      .map((r) => ({
        id: r.id,
        ticketType: r.ticket_type as "general" | "daily" | "extra",
        bolaoDefinitionId: r.bolao_definition_id,
      }));

    const artilheiroTicketIds = rows
      .filter((r) => r.ticket_type === "artilheiros")
      .map((r) => r.id);

    const [scoped, artilheiroRanking] = await Promise.all([
      scopedTickets.length > 0
        ? resolvePaidTicketRankingPositions(scopedTickets, userId).catch(() => null)
        : Promise.resolve(null),
      artilheiroTicketIds.length > 0
        ? (async () => {
            const results = await listArtilheiroOfficialResults().catch(() => []);
            if (!isArtilheiroResultApplied(results)) return null;
            return buildArtilheiroRanking(5000).catch(() => []);
          })()
        : Promise.resolve(null),
    ]);

    if (scoped) {
      for (const ticket of scopedTickets) {
        const row = scoped.get(ticket.id);
        positions[ticket.id] = {
          position: row?.position ?? null,
          points: row?.points ?? 0,
        };
      }
    }

    if (artilheiroRanking) {
      const byTicket = new Map(
        artilheiroRanking.map((r) => [r.ticketId, r]),
      );
      for (const ticketId of artilheiroTicketIds) {
        const row = byTicket.get(ticketId);
        positions[ticketId] = {
          position: row?.position ?? null,
          points: row?.totalPoints ?? 0,
        };
      }
    }

    const bestPosition = Object.values(positions)
      .map((p) => p.position)
      .filter((p): p is number => p != null)
      .reduce<number | null>((min, p) => (min == null || p < min ? p : min), null);

    return NextResponse.json({ positions, bestPosition });
  } catch (error) {
    console.error("[boloes/ticket-positions]", error);
    return NextResponse.json({ positions: {}, bestPosition: null });
  }
}
