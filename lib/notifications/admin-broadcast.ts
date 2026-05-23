import { getPool } from "@/lib/db";

export type {
  AdminBroadcastChannel,
  AdminBroadcastHistoryItem,
  AdminDeliveryMethod,
  AdminNotificationUserOption,
} from "@/lib/notifications/admin-broadcast-shared";
export {
  adminDeliveryMethodLabel,
  parseAdminDeliveryMethod,
} from "@/lib/notifications/admin-broadcast-shared";

import type {
  AdminBroadcastChannel,
  AdminBroadcastHistoryItem,
  AdminNotificationUserOption,
} from "@/lib/notifications/admin-broadcast-shared";

const INSERT_CHUNK = 200;

function buildAppNotificationKind(
  channels: AdminBroadcastChannel[],
  batchId: string,
): string {
  const key =
    channels.includes("app") && channels.includes("email")
      ? "app+email"
      : channels.includes("email")
        ? "email"
        : "app";
  return `admin_broadcast:v2:${key}:${batchId}`;
}

async function ensureAdminBroadcastBatchesTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_notification_batches (
      batch_id       UUID PRIMARY KEY,
      channels       TEXT NOT NULL,
      title          TEXT NOT NULL,
      preview        TEXT NOT NULL,
      app_recipients INT NOT NULL DEFAULT 0,
      email_sent     INT NOT NULL DEFAULT 0,
      email_failed   INT NOT NULL DEFAULT 0,
      email_queued   BOOLEAN NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS admin_notification_batches_created_idx
      ON admin_notification_batches (created_at DESC);
  `);
}

async function ensureUserNotificationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      kind       text NOT NULL DEFAULT 'system',
      title      text NOT NULL,
      preview    text NOT NULL,
      body       text NOT NULL,
      read_at    timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
      ON user_notifications (user_id, created_at DESC);
  `);
}

export async function countBroadcastEligibleUsers(): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM users
     WHERE email IS NOT NULL AND trim(email) <> ''`,
  );
  return rows[0]?.n ?? 0;
}

export async function listAllBroadcastUserIds(): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users
     WHERE email IS NOT NULL AND trim(email) <> ''
     ORDER BY created_at DESC`,
  );
  return rows.map((r) => r.id);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuidList(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => UUID_RE.test(id)))];
}

export async function searchUsersForAdminNotification(
  query: string,
  options?: { limit?: number; excludeIds?: string[] },
): Promise<AdminNotificationUserOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const pool = getPool();
  const like = `%${q.toLowerCase()}%`;
  const digits = q.replace(/\D/g, "");
  const limit = Math.min(Math.max(options?.limit ?? 15, 1), 30);
  const excludeIds = normalizeUuidList(options?.excludeIds ?? []);

  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT id, email, name
     FROM users
     WHERE email IS NOT NULL AND trim(email) <> ''
       AND (cardinality($4::uuid[]) = 0 OR NOT (id = ANY($4::uuid[])))
       AND (
         lower(email) LIKE $1
         OR lower(COALESCE(name, '')) LIKE $1
         OR ($2 <> '' AND regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') LIKE '%' || $2 || '%')
       )
     ORDER BY email ASC
     LIMIT $3`,
    [like, digits, limit, excludeIds],
  );

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
  }));
}

/** IDs válidos com e-mail cadastrado (para envio selecionado). */
export async function resolveBroadcastUserIds(ids: string[]): Promise<string[]> {
  const uniqueIds = normalizeUuidList(ids);
  if (uniqueIds.length === 0) return [];

  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users
     WHERE id = ANY($1::uuid[])
       AND email IS NOT NULL AND trim(email) <> ''`,
    [uniqueIds],
  );
  return rows.map((r) => r.id);
}

export async function recordAdminBroadcastBatch(input: {
  batchId: string;
  channels: AdminBroadcastChannel[];
  title: string;
  preview: string;
  appRecipients?: number;
  emailSent?: number;
  emailFailed?: number;
  emailQueued?: boolean;
}): Promise<void> {
  await ensureAdminBroadcastBatchesTable();
  const channelsKey =
    input.channels.includes("app") && input.channels.includes("email")
      ? "app+email"
      : input.channels[0] ?? "app";

  const pool = getPool();
  await pool.query(
    `INSERT INTO admin_notification_batches (
       batch_id, channels, title, preview,
       app_recipients, email_sent, email_failed, email_queued
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (batch_id) DO UPDATE SET
       app_recipients = EXCLUDED.app_recipients,
       email_sent = EXCLUDED.email_sent,
       email_failed = EXCLUDED.email_failed,
       email_queued = EXCLUDED.email_queued`,
    [
      input.batchId,
      channelsKey,
      input.title,
      input.preview,
      input.appRecipients ?? 0,
      input.emailSent ?? 0,
      input.emailFailed ?? 0,
      input.emailQueued ?? false,
    ],
  );
}

export async function updateAdminBroadcastBatchEmailStats(
  batchId: string,
  stats: { emailSent: number; emailFailed: number; emailQueued: boolean },
): Promise<void> {
  await ensureAdminBroadcastBatchesTable();
  const pool = getPool();
  await pool.query(
    `UPDATE admin_notification_batches SET
       email_sent = $2,
       email_failed = $3,
       email_queued = $4
     WHERE batch_id = $1`,
    [batchId, stats.emailSent, stats.emailFailed, stats.emailQueued],
  );
}

export async function createAdminBroadcastNotifications(input: {
  userIds: string[];
  title: string;
  preview: string;
  body: string;
  batchId?: string;
  channels: AdminBroadcastChannel[];
}): Promise<{ created: number; batchId: string }> {
  await ensureUserNotificationsTable();

  const uniqueIds = normalizeUuidList(input.userIds);
  const batchId = input.batchId ?? crypto.randomUUID();

  if (!input.channels.includes("app") || uniqueIds.length === 0) {
    return { created: 0, batchId };
  }

  const kind = buildAppNotificationKind(input.channels, batchId);
  const pool = getPool();
  let created = 0;

  for (let i = 0; i < uniqueIds.length; i += INSERT_CHUNK) {
    const chunk = uniqueIds.slice(i, i + INSERT_CHUNK);
    const { rowCount } = await pool.query(
      `INSERT INTO user_notifications (user_id, kind, title, preview, body)
       SELECT usr.id, $2, $3, $4, $5
       FROM users usr
       WHERE usr.id = ANY($1::uuid[])`,
      [chunk, kind, input.title, input.preview, input.body],
    );
    created += rowCount ?? 0;
  }

  return { created, batchId };
}

async function listLegacyAdminBroadcastHistory(
  limit: number,
): Promise<AdminBroadcastHistoryItem[]> {
  await ensureUserNotificationsTable();
  const pool = getPool();
  const { rows } = await pool.query<{
    batch_id: string;
    sent_at: Date;
    title: string;
    preview: string;
    recipients: number;
  }>(
    `SELECT
       CASE
         WHEN kind LIKE 'admin_broadcast:v2:%' THEN split_part(kind, ':', 4)
         ELSE split_part(kind, ':', 2)
       END AS batch_id,
       MIN(created_at) AS sent_at,
       MAX(title) AS title,
       MAX(preview) AS preview,
       COUNT(*)::int AS recipients
     FROM user_notifications
     WHERE kind LIKE 'admin_broadcast:%'
     GROUP BY 1
     ORDER BY MIN(created_at) DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    batchId: r.batch_id,
    sentAt: r.sent_at.toISOString(),
    channels: "app",
    title: r.title,
    preview: r.preview,
    appRecipients: r.recipients,
    emailSent: 0,
    emailFailed: 0,
    emailQueued: false,
  }));
}

export async function listAdminBroadcastHistory(
  limit = 50,
): Promise<AdminBroadcastHistoryItem[]> {
  await ensureAdminBroadcastBatchesTable();
  const pool = getPool();
  const capped = Math.min(Math.max(limit, 1), 100);

  const { rows } = await pool.query<{
    batch_id: string;
    channels: string;
    sent_at: Date;
    title: string;
    preview: string;
    app_recipients: number;
    email_sent: number;
    email_failed: number;
    email_queued: boolean;
  }>(
    `SELECT
       batch_id,
       channels,
       created_at AS sent_at,
       title,
       preview,
       app_recipients,
       email_sent,
       email_failed,
       email_queued
     FROM admin_notification_batches
     ORDER BY created_at DESC
     LIMIT $1`,
    [capped],
  );

  if (rows.length > 0) {
    return rows.map((r) => ({
      batchId: r.batch_id,
      sentAt: r.sent_at.toISOString(),
      channels: r.channels,
      title: r.title,
      preview: r.preview,
      appRecipients: r.app_recipients,
      emailSent: r.email_sent,
      emailFailed: r.email_failed,
      emailQueued: r.email_queued,
    }));
  }

  return listLegacyAdminBroadcastHistory(capped);
}
