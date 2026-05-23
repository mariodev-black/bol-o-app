import { getPool } from "@/lib/db";

export type EmailCampaignRunStatus = "pending" | "running" | "completed";

let campaignTablesReady: Promise<void> | null = null;

/** Idempotente — chamado no boot e antes de cada operação de campanha. */
export function ensureEmailCampaignTables(): Promise<void> {
  if (!campaignTablesReady) {
    campaignTablesReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_campaign_runs (
          campaign_id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'pending',
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          sent_count INT NOT NULL DEFAULT 0,
          skipped_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          last_error TEXT,
          CONSTRAINT email_campaign_runs_status_chk
            CHECK (status IN ('pending', 'running', 'completed'))
        );
        CREATE TABLE IF NOT EXISTS email_campaign_sends (
          campaign_id TEXT NOT NULL,
          email_normalized TEXT NOT NULL,
          user_id UUID,
          resend_id TEXT,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (campaign_id, email_normalized)
        );
        CREATE INDEX IF NOT EXISTS email_campaign_sends_campaign_sent_idx
          ON email_campaign_sends (campaign_id, sent_at DESC);
      `);
    })().catch((err) => {
      campaignTablesReady = null;
      throw err;
    });
  }
  return campaignTablesReady;
}

export async function getEmailCampaignRunStatus(
  campaignId: string,
): Promise<EmailCampaignRunStatus | null> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  const { rows } = await pool.query<{ status: EmailCampaignRunStatus }>(
    `SELECT status FROM email_campaign_runs WHERE campaign_id = $1`,
    [campaignId],
  );
  return rows[0]?.status ?? null;
}

/** Registra envio bem-sucedido; retorna false se o e-mail já recebeu esta campanha. */
export async function tryRecordEmailCampaignSend(input: {
  campaignId: string;
  emailNormalized: string;
  userId: string | null;
  resendId: string | null;
}): Promise<boolean> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  const { rowCount } = await pool.query(
    `INSERT INTO email_campaign_sends (campaign_id, email_normalized, user_id, resend_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (campaign_id, email_normalized) DO NOTHING`,
    [input.campaignId, input.emailNormalized, input.userId, input.resendId],
  );
  return (rowCount ?? 0) > 0;
}

export async function hasEmailCampaignSend(
  campaignId: string,
  emailNormalized: string,
): Promise<boolean> {
  const sent = await loadSentEmailSet(campaignId);
  return sent.has(emailNormalized.trim().toLowerCase());
}

/** E-mails que já receberam a campanha (uma query — evita N round-trips). */
export async function loadSentEmailSet(campaignId: string): Promise<Set<string>> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  const { rows } = await pool.query<{ email_normalized: string }>(
    `SELECT email_normalized FROM email_campaign_sends WHERE campaign_id = $1`,
    [campaignId],
  );
  return new Set(rows.map((r) => r.email_normalized));
}

export async function markEmailCampaignRunStarted(campaignId: string): Promise<void> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  await pool.query(
    `INSERT INTO email_campaign_runs (campaign_id, status, started_at)
     VALUES ($1, 'running', now())
     ON CONFLICT (campaign_id) DO UPDATE SET
       status = CASE
         WHEN email_campaign_runs.status = 'completed' THEN 'completed'
         ELSE 'running'
       END,
       started_at = COALESCE(email_campaign_runs.started_at, now())`,
    [campaignId],
  );
}

export async function countEmailCampaignSends(campaignId: string): Promise<number> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  const { rows } = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM email_campaign_sends WHERE campaign_id = $1`,
    [campaignId],
  );
  return rows[0]?.c ?? 0;
}

export async function markEmailCampaignRunCompleted(input: {
  campaignId: string;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  lastError?: string | null;
}): Promise<void> {
  await ensureEmailCampaignTables();
  const pool = getPool();
  await pool.query(
    `UPDATE email_campaign_runs SET
       status = 'completed',
       completed_at = now(),
       sent_count = $2,
       skipped_count = $3,
       failed_count = $4,
       last_error = $5
     WHERE campaign_id = $1`,
    [
      input.campaignId,
      input.sentCount,
      input.skippedCount,
      input.failedCount,
      input.lastError ?? null,
    ],
  );
}

export type CampaignRecipient = {
  userId: string;
  email: string;
  emailNormalized: string;
  name: string | null;
};

/** Um registro por e-mail (evita duplicata se houver contas repetidas). */
export async function listCampaignRecipients(): Promise<CampaignRecipient[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    user_id: string;
    email: string;
    email_normalized: string;
    name: string | null;
  }>(
    `SELECT
       (array_agg(u.id ORDER BY u.id ASC))[1] AS user_id,
       lower(trim(u.email)) AS email_normalized,
       (array_agg(u.email ORDER BY u.id ASC))[1] AS email,
       (array_agg(u.name ORDER BY u.id ASC))[1] AS name
     FROM users u
     WHERE u.email IS NOT NULL AND trim(u.email) <> ''
     GROUP BY lower(trim(u.email))`,
  );
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    emailNormalized: r.email_normalized,
    name: r.name,
  }));
}
