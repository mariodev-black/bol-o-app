-- Fluxo de tickets e transacoes de deposito (Skale PIX)
-- Execute apos scripts/auth-schema.sql
--
-- psql "$DATABASE_URL" -f scripts/payments-schema.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type_enum') THEN
    CREATE TYPE ticket_type_enum AS ENUM ('general', 'daily');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ticket_type ticket_type_enum NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending_payment',
  external_ref TEXT NOT NULL UNIQUE,
  transaction_id UUID,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    ALTER TABLE payment_transactions RENAME TO transactions;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  ticket_type ticket_type_enum NOT NULL,
  provider TEXT NOT NULL DEFAULT 'skale',
  provider_transaction_id TEXT UNIQUE,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method TEXT NOT NULL DEFAULT 'pix',
  pix_qrcode TEXT,
  pix_end2end_id TEXT,
  external_ref TEXT NOT NULL UNIQUE,
  raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_transaction_fk'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_transaction_fk
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tickets_user_created ON tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions (provider_transaction_id);
