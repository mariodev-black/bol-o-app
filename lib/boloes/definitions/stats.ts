import { getPool } from "@/lib/db";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import { mapBolaoDefinitionRow } from "@/lib/boloes/definitions/mapper";
import type { BolaoDefinitionStats, BolaoDefinitionWithStats } from "@/lib/boloes/definitions/types";

export type { BolaoDefinitionStats, BolaoDefinitionWithStats };

const STATS_SELECT = `
  SELECT
    bd.id AS bolao_definition_id,
    COALESCE(ts.tickets_paid, 0)::int AS tickets_paid,
    COALESCE(ts.tickets_pending, 0)::int AS tickets_pending,
    COALESCE(ts.revenue_cents, 0)::int AS revenue_cents,
    COALESCE(ts.participants, 0)::int AS participants,
    COALESCE(ps.predictions_count, 0)::int AS predictions_count
  FROM bolao_definitions bd
  LEFT JOIN (
    SELECT
      bolao_definition_id,
      COUNT(*) FILTER (WHERE status IN ('paid', 'approved')) AS tickets_paid,
      COUNT(*) FILTER (WHERE status = 'pending_payment') AS tickets_pending,
      COALESCE(SUM(total_amount_cents) FILTER (WHERE status IN ('paid', 'approved')), 0) AS revenue_cents,
      COUNT(DISTINCT user_id) FILTER (WHERE status IN ('paid', 'approved')) AS participants
    FROM tickets
    WHERE bolao_definition_id IS NOT NULL
    GROUP BY bolao_definition_id
  ) ts ON ts.bolao_definition_id = bd.id
  LEFT JOIN (
    SELECT
      t.bolao_definition_id,
      COUNT(p.ticket_id) AS predictions_count
    FROM tickets t
    INNER JOIN predictions p ON p.ticket_id::text = t.id::text
    WHERE t.bolao_definition_id IS NOT NULL
    GROUP BY t.bolao_definition_id
  ) ps ON ps.bolao_definition_id = bd.id
`;

async function loadStatsMap(): Promise<Map<string, BolaoDefinitionStats>> {
  const pool = getPool();
  const { rows } = await pool.query<{
    bolao_definition_id: string;
    tickets_paid: string;
    tickets_pending: string;
    revenue_cents: string;
    participants: string;
    predictions_count: string;
  }>(`${STATS_SELECT}`);

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
    `${STATS_SELECT}
     WHERE bd.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) {
    return {
      ticketsPaid: 0,
      ticketsPending: 0,
      revenueCents: 0,
      participants: 0,
      predictionsCount: 0,
    };
  }
  return {
    ticketsPaid: Number(r.tickets_paid) || 0,
    ticketsPending: Number(r.tickets_pending) || 0,
    revenueCents: Number(r.revenue_cents) || 0,
    participants: Number(r.participants) || 0,
    predictionsCount: Number(r.predictions_count) || 0,
  };
}
