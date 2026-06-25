-- Amplia status de saque para fluxo Cartwave (processing / failed / refunded).
ALTER TABLE affiliate_withdrawal_requests
  DROP CONSTRAINT IF EXISTS affiliate_withdrawal_requests_status_check;

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
