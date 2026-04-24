import { getPool } from "@/lib/db";

export type PaidTicketRow = {
  id: string;
  ticketType: "general" | "daily";
  quantity: number;
  paidAt: string | null;
  createdAt: string;
};

/** Tickets com pagamento confirmado (origem do banco — fonte de verdade). */
export async function listPaidTicketsForUser(userId: string): Promise<PaidTicketRow[]> {
  const pool = getPool();
  try {
    const { rows } = await pool.query<{
      id: string;
      ticket_type: "general" | "daily";
      quantity: number;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, ticket_type, quantity, paid_at, created_at
       FROM tickets
       WHERE user_id = $1 AND status = 'paid'
       ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST, created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      ticketType: r.ticket_type,
      quantity: Math.max(1, r.quantity),
      paidAt: r.paid_at ? r.paid_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));
  } catch (e) {
    console.error("[user-tickets] listPaidTicketsForUser", e);
    return [];
  }
}
