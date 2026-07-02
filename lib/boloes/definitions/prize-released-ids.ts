import { getPool } from "@/lib/db";

export async function loadPrizeReleasedDefinitionIds(
  definitionIds: string[],
): Promise<Set<string>> {
  if (definitionIds.length === 0) return new Set();
  const pool = getPool();
  const { rows } = await pool.query<{ bolao_definition_id: string }>(
    `SELECT DISTINCT (metadata->>'bolaoDefinitionId')::text AS bolao_definition_id
       FROM prize_closures
      WHERE metadata->>'bolaoDefinitionId' = ANY($1::text[])
        AND processado = true`,
    [definitionIds],
  ).catch(() => ({ rows: [] as { bolao_definition_id: string }[] }));
  return new Set(rows.map((r) => r.bolao_definition_id).filter(Boolean));
}
