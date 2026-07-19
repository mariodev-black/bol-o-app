import type { PoolClient } from "pg";

/** Garante constraint de status compatível com Cartwave (processing, failed, refunded). */
export async function ensureWithdrawalStatusConstraint(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'affiliate_withdrawal_requests_status_check'
          AND pg_get_constraintdef(oid) NOT LIKE '%processing%'
      ) THEN
        ALTER TABLE affiliate_withdrawal_requests
          DROP CONSTRAINT affiliate_withdrawal_requests_status_check;
        ALTER TABLE affiliate_withdrawal_requests
          ADD CONSTRAINT affiliate_withdrawal_requests_status_check
          CHECK (
            status = ANY (
              ARRAY[
                'pending'::text,
                'processing'::text,
                'approved'::text,
                'paid'::text,
                'rejected'::text,
                'failed'::text,
                'refunded'::text
              ]
            )
          );
      END IF;
    EXCEPTION
      WHEN undefined_object THEN
        ALTER TABLE affiliate_withdrawal_requests
          ADD CONSTRAINT affiliate_withdrawal_requests_status_check
          CHECK (
            status = ANY (
              ARRAY[
                'pending'::text,
                'processing'::text,
                'approved'::text,
                'paid'::text,
                'rejected'::text,
                'failed'::text,
                'refunded'::text
              ]
            )
          );
    END $$;
  `);
}

/**
 * Saque unificado grava balance_source = 'combined'.
 * Bancos antigos só aceitavam affiliate|wallet — isso quebra o INSERT.
 */
export async function ensureWithdrawalBalanceSourceConstraint(
  client: PoolClient,
): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'affiliate_withdrawal_requests_balance_source_check'
          AND pg_get_constraintdef(oid) NOT LIKE '%combined%'
      ) THEN
        ALTER TABLE affiliate_withdrawal_requests
          DROP CONSTRAINT affiliate_withdrawal_requests_balance_source_check;
        ALTER TABLE affiliate_withdrawal_requests
          ADD CONSTRAINT affiliate_withdrawal_requests_balance_source_check
          CHECK (
            balance_source = ANY (
              ARRAY[
                'affiliate'::text,
                'wallet'::text,
                'combined'::text
              ]
            )
          );
      END IF;
    EXCEPTION
      WHEN undefined_object THEN
        ALTER TABLE affiliate_withdrawal_requests
          ADD CONSTRAINT affiliate_withdrawal_requests_balance_source_check
          CHECK (
            balance_source = ANY (
              ARRAY[
                'affiliate'::text,
                'wallet'::text,
                'combined'::text
              ]
            )
          );
    END $$;
  `);
}

export async function ensureWithdrawalSchema(client: PoolClient): Promise<void> {
  await ensureWithdrawalStatusConstraint(client);
  await ensureWithdrawalBalanceSourceConstraint(client);
}
