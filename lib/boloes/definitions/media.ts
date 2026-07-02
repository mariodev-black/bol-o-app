import type { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";

let mediaEnsured = false;

async function ensureMediaTable(client?: PoolClient): Promise<void> {
  if (mediaEnsured && !client) return;
  const pool = getPool();
  const c = client ?? (await pool.connect());
  const release = !client;
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS bolao_definition_media (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        image_data bytea NOT NULL,
        image_mime text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    mediaEnsured = true;
  } finally {
    if (release) c.release();
  }
}

export function bolaoDefinitionMediaPublicUrl(id: string): string {
  return `/api/public/bolao-definition-media/${id}`;
}

export async function saveBolaoDefinitionMedia(
  data: Buffer,
  mime: string,
): Promise<string> {
  await ensureMediaTable();
  const id = randomUUID();
  const pool = getPool();
  await pool.query(
    `INSERT INTO bolao_definition_media (id, image_data, image_mime) VALUES ($1, $2::bytea, $3)`,
    [id, data, mime],
  );
  return id;
}

export async function readBolaoDefinitionMedia(
  id: string,
): Promise<{ data: Buffer; mime: string } | null> {
  await ensureMediaTable();
  const pool = getPool();
  const { rows } = await pool.query<{ image_data: Buffer; image_mime: string }>(
    `SELECT image_data, image_mime FROM bolao_definition_media WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row?.image_data) return null;
  return { data: row.image_data, mime: row.image_mime || "image/png" };
}
