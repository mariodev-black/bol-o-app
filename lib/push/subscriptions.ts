import { getPool } from "@/lib/db";

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function ensurePushSubscriptionsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
    );
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
      ON push_subscriptions (user_id);
  `);
}

export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await ensurePushSubscriptionsTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = now()`,
    [
      input.userId,
      input.endpoint,
      input.p256dh,
      input.auth,
      input.userAgent ?? null,
    ],
  );
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await ensurePushSubscriptionsTable();
  const pool = getPool();
  await pool.query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint],
  );
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await ensurePushSubscriptionsTable();
  const pool = getPool();
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [
    endpoint,
  ]);
}

export async function listPushSubscriptionsForUsers(
  userIds: string[],
): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  await ensurePushSubscriptionsTable();
  const pool = getPool();
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT id, user_id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  return rows;
}

export async function countPushSubscriptionsForUser(
  userId: string,
): Promise<number> {
  await ensurePushSubscriptionsTable();
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}
