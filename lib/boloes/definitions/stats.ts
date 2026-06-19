import { getPool } from "@/lib/db";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import { mapBolaoDefinitionRow } from "@/lib/boloes/definitions/mapper";
import type { BolaoDefinitionStats, BolaoDefinitionWithStats } from "@/lib/boloes/definitions/types";

export type { BolaoDefinitionStats, BolaoDefinitionWithStats };

async function loadStatsMap(): Promise<Map<string, BolaoDefinitionStats>> {
  const pool = getPool();
  const { rows } = await pool.query<{
    bolao_definition_id: string;
    tickets_paid: string;
    tickets_pending: string;
    revenue_cents: string;
    participants: string;
    predictions_count: string;
  }>(
    `SELECT
       bd.id AS bolao_definition_id,
       COUNT(t.id) FILTER (WHERE t.status IN ('paid', 'approved'))::int AS tickets_paid,
       COUNT(t.id) FILTER (WHERE t.status = 'pending_payment')::int AS tickets_pending,
       COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.status IN ('paid', 'approved')), 0)::int AS revenue_cents,
       COUNT(DISTINCT p.ticket_id) FILTER (WHERE p.ticket_id IS NOT NULL)::int AS participants,
       COUNT(p.ticket_id)::int AS predictions_count
     FROM bolao_definitions bd
     LEFT JOIN tickets t ON t.bolao_definition_id = bd.id
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text
     GROUP BY bd.id`,
  );

  const out = new Map<string, BolaoDefinitionStats>();
  for (const r of rows) {
    out.set(r.bolao_definition_id, {
      ticketsPaid: Number(r.tickets_paid) || 0,
      ticketsPending: Number(r.tickets_pending) || 0,
      revenueCents: Number(r.revenue_cents) || 0,
      participants: Number(r.participants) || 0,
      predictionsCount: Number(r.predictions_count) || 0,
    });
  }
  return out;
}

export async function listBolaoDefinitionsWithStats(opts?: {
  includeDisabled?: boolean;
}): Promise<BolaoDefinitionWithStats[]> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM bolao_definitions
      ${opts?.includeDisabled ? "" : "WHERE enabled = true"}
      ORDER BY sort_order ASC, display_name ASC`,
  );
  const statsMap = await loadStatsMap();
  return rows.map((row) => {
    const def = mapBolaoDefinitionRow(row);
    const stats = statsMap.get(def.id) ?? {
      ticketsPaid: 0,
      ticketsPending: 0,
      revenueCents: 0,
      participants: 0,
      predictionsCount: 0,
    };
    return { ...def, ...stats };
  });
}

export async function getBolaoDefinitionStats(id: string): Promise<BolaoDefinitionStats | null> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query<{
    tickets_paid: string;
    tickets_pending: string;
    revenue_cents: string;
    participants: string;
    predictions_count: string;
  }>(
    `SELECT
       COUNT(t.id) FILTER (WHERE t.status IN ('paid', 'approved'))::int AS tickets_paid,
       COUNT(t.id) FILTER (WHERE t.status = 'pending_payment')::int AS tickets_pending,
       COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.status IN ('paid', 'approved')), 0)::int AS revenue_cents,
       COUNT(DISTINCT p.ticket_id) FILTER (WHERE p.ticket_id IS NOT NULL)::int AS participants,
       COUNT(p.ticket_id)::int AS predictions_count
     FROM bolao_definitions bd
     LEFT JOIN tickets t ON t.bolao_definition_id = bd.id
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text
     WHERE bd.id = $1
     GROUP BY bd.id`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ticketsPaid: Number(r.tickets_paid) || 0,
    ticketsPending: Number(r.tickets_pending) || 0,
    revenueCents: Number(r.revenue_cents) || 0,
    participants: Number(r.participants) || 0,
    predictionsCount: Number(r.predictions_count) || 0,
  };
}
