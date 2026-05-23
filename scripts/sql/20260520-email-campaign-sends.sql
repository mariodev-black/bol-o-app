-- Envios de campanhas por e-mail (idempotente: 1 registro por campanha + e-mail).

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
