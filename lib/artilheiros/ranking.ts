import { getPool } from "@/lib/db";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";

export type ArtilheiroRankingRow = {
  ticketId: string;
  userId: string;
  userName: string;
  avatarIndex: number;
  position: number;
  totalPoints: number;
  positionPoints: number;
  bonusPoints: number;
  picksCount: number;
  cotaOrdinal: number;
};

export async function buildArtilheiroRanking(limit = 100): Promise<ArtilheiroRankingRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    ticket_id: string;
    user_id: string;
    user_name: string;
    avatar_index: number | null;
    total_points: number;
    position_points: number;
    bonus_points: number;
    picks_count: string;
    cota_ordinal: number;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `WITH paid AS (
       SELECT t.id, t.user_id, t.paid_at, t.created_at,
              ROW_NUMBER() OVER (
                PARTITION BY t.user_id
                ORDER BY COALESCE(t.paid_at, t.created_at) ASC, t.id ASC
              ) AS cota_ordinal
       FROM tickets t
       WHERE t.ticket_type = 'artilheiros' AND t.status = 'paid'
     ),
     pick_counts AS (
       SELECT ticket_id, COUNT(*)::int AS picks_count
       FROM artilheiro_picks
       GROUP BY ticket_id
     )
     SELECT p.id::text AS ticket_id,
            p.user_id::text AS user_id,
            COALESCE(u.name, 'Usuario') AS user_name,
            u.avatar_index,
            COALESCE(s.total_points, 0) AS total_points,
            COALESCE(s.position_points, 0) AS position_points,
            COALESCE(s.bonus_points, 0) AS bonus_points,
            COALESCE(pc.picks_count, 0)::text AS picks_count,
            paid.cota_ordinal::int AS cota_ordinal
     FROM paid
     JOIN tickets p ON p.id = paid.id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN artilheiro_ticket_scores s ON s.ticket_id = p.id
     LEFT JOIN pick_counts pc ON pc.ticket_id = p.id
     ORDER BY COALESCE(s.total_points, 0) DESC,
              COALESCE(s.position_points, 0) DESC,
              COALESCE(s.bonus_points, 0) DESC,
              paid.cota_ordinal ASC
     LIMIT $1`,
    [limit],
  );

  return rows.map((r, index) => ({
    ticketId: r.ticket_id,
    userId: r.user_id,
    userName: r.user_name,
    avatarIndex: clampAvatarIndex(r.avatar_index ?? 0),
    position: index + 1,
    totalPoints: Number(r.total_points),
    positionPoints: Number(r.position_points),
    bonusPoints: Number(r.bonus_points),
    picksCount: Number(r.picks_count),
    cotaOrdinal: Number(r.cota_ordinal),
  }));
}

export async function countArtilheirosParticipants(): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM tickets
     WHERE ticket_type = 'artilheiros' AND status = 'paid'`,
  );
  return Number(rows[0]?.n) || 0;
}

export async function getArtilheiroTicketScore(ticketId: string): Promise<{
  totalPoints: number;
  positionPoints: number;
  bonusPoints: number;
  rankingPosition: number | null;
} | null> {
  const ranking = await buildArtilheiroRanking(5000);
  const row = ranking.find((r) => r.ticketId === ticketId);
  if (!row) return null;
  return {
    totalPoints: row.totalPoints,
    positionPoints: row.positionPoints,
    bonusPoints: row.bonusPoints,
    rankingPosition: row.position,
  };
}
