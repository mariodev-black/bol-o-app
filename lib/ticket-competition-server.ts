import { getPool } from "@/lib/db";

/** `extra_championship_id` por ticket (só linhas `ticket_type = 'extra'`). */
export async function fetchExtraChampionshipIdByTicketIds(ticketIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(ticketIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; extra_championship_id: number | null }>(
    `SELECT id::text AS id, extra_championship_id
     FROM tickets
     WHERE id = ANY($1::uuid[]) AND ticket_type = 'extra'`,
    [ids]
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const c = r.extra_championship_id;
    if (c != null && Number.isFinite(Number(c)) && Number(c) > 0) out.set(r.id, Number(c));
  }
  return out;
}
