import { getPool } from "@/lib/db";
import { inferBolaoTypeFromTicketPrefix, normalizeTicketIdForDbLookup } from "@/lib/ticket-kind-shared";

/** Só em rotas API / Server Actions (usa `pg`). */
export async function inferBolaoTypeFromTicketId(ticketId: string): Promise<"principal" | "diario" | "extra" | null> {
  const fromPrefix = inferBolaoTypeFromTicketPrefix(ticketId);
  if (fromPrefix) return fromPrefix;

  const raw = ticketId.trim();
  if (!raw) return null;
  const forDb = normalizeTicketIdForDbLookup(raw);

  try {
    const pool = getPool();
    const { rows } = await pool.query<{ ticket_type: "general" | "daily" | "extra" }>(
      `SELECT ticket_type FROM tickets WHERE id = $1 LIMIT 1`,
      [forDb]
    );
    const t = rows[0]?.ticket_type;
    if (t === "general") return "principal";
    if (t === "daily") return "diario";
    if (t === "extra") return "extra";
    return null;
  } catch {
    return null;
  }
}
