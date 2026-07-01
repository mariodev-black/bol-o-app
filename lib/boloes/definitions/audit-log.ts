import { getPool } from "@/lib/db";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import type { BolaoDefinitionAuditLog } from "@/lib/boloes/definitions/types";

export async function appendBolaoDefinitionAuditLog(input: {
  bolaoDefinitionId: string;
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  await pool.query(
    `INSERT INTO bolao_definition_audit_logs (
       bolao_definition_id, action, actor_user_id, actor_email, payload
     ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.bolaoDefinitionId,
      input.action,
      input.actorUserId ?? null,
      input.actorEmail ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

export async function listBolaoDefinitionAuditLogs(
  bolaoDefinitionId: string,
  limit = 50,
): Promise<BolaoDefinitionAuditLog[]> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    bolao_definition_id: string;
    action: string;
    actor_user_id: string | null;
    actor_email: string | null;
    payload: unknown;
    created_at: Date;
  }>(
    `SELECT id, bolao_definition_id, action, actor_user_id, actor_email, payload, created_at
       FROM bolao_definition_audit_logs
      WHERE bolao_definition_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [bolaoDefinitionId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    bolaoDefinitionId: r.bolao_definition_id,
    action: r.action,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    payload:
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {},
    createdAt: r.created_at.toISOString(),
  }));
}
