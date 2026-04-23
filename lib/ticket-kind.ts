import { getPool } from "@/lib/db";

export async function inferBolaoTypeFromTicketId(ticketId: string): Promise<"principal" | "diario" | null> {
  const id = ticketId.trim().toUpperCase();
  if (!id) return null;
  if (id.startsWith("TG-")) return "principal";
  if (id.startsWith("TD-")) return "diario";

  // Fallback: tickets comprados no banco (UUID)
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ ticket_type: "general" | "daily" }>(
      `SELECT ticket_type FROM tickets WHERE id::text = $1 LIMIT 1`,
      [ticketId]
    );
    const t = rows[0]?.ticket_type;
    if (t === "general") return "principal";
    if (t === "daily") return "diario";
    return null;
  } catch {
    return null;
  }
}

