import { parseTransactionalEmail } from "@/lib/email/address";
import { getCampaignSendDelayMs } from "@/lib/email/deliverability";
import { EMAIL_TAG_PIX_RECOVERY_COPA } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { PIX_RECOVERY_EMAIL_BUILDERS } from "@/lib/email/templates/pix-recovery-copa-2026";
import { tryWithFootballAdvisoryLock } from "@/lib/football/advisory-locks";
import { getPool } from "@/lib/db";

// ────────────────────────────────────────────────
// Step definitions
// ────────────────────────────────────────────────

export type PixRecoveryStepId =
  | "r01_15min"
  | "r02_2h"
  | "r03_6h"
  | "r04_12h_agressivo"
  | "r05_24h"
  | "r06_36h_ganancia"
  | "r07_48h"
  | "r08_72h";

type RecoveryStep = {
  id: PixRecoveryStepId;
  /** Mínimo de minutos desde a criação do PIX para este step. */
  minAgo: number;
  /** Máximo de minutos desde a criação do PIX (janela de envio de 60 min). */
  maxAgo: number;
  advisoryLock: number;
};

const RECOVERY_STEPS: RecoveryStep[] = [
  { id: "r01_15min",         minAgo: 10,   maxAgo: 70,   advisoryLock: 7_203_200 },
  { id: "r02_2h",            minAgo: 90,   maxAgo: 150,  advisoryLock: 7_203_201 },
  { id: "r03_6h",            minAgo: 330,  maxAgo: 390,  advisoryLock: 7_203_202 },
  { id: "r04_12h_agressivo", minAgo: 690,  maxAgo: 750,  advisoryLock: 7_203_203 },
  { id: "r05_24h",           minAgo: 1410, maxAgo: 1470, advisoryLock: 7_203_204 },
  { id: "r06_36h_ganancia",  minAgo: 2130, maxAgo: 2190, advisoryLock: 7_203_205 },
  { id: "r07_48h",           minAgo: 2850, maxAgo: 2910, advisoryLock: 7_203_206 },
  { id: "r08_72h",           minAgo: 4290, maxAgo: 4350, advisoryLock: 7_203_207 },
];

const SEND_DELAY_MS = getCampaignSendDelayMs();

// ────────────────────────────────────────────────
// DB setup
// ────────────────────────────────────────────────

let recoveryTablesReady: Promise<void> | null = null;

export function ensurePixRecoveryTables(): Promise<void> {
  if (!recoveryTablesReady) {
    recoveryTablesReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pix_recovery_sends (
          transaction_id UUID NOT NULL,
          step           TEXT NOT NULL,
          user_id        UUID,
          email_normalized TEXT NOT NULL,
          resend_id      TEXT,
          sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (transaction_id, step)
        );
        CREATE INDEX IF NOT EXISTS pix_recovery_sends_user_step_idx
          ON pix_recovery_sends (user_id, step, sent_at DESC);
      `);
    })().catch((err) => {
      recoveryTablesReady = null;
      throw err;
    });
  }
  return recoveryTablesReady;
}

// ────────────────────────────────────────────────
// Eligible transactions query
// ────────────────────────────────────────────────

type RecoveryRecipient = {
  transactionId: string;
  userId: string;
  email: string;
  name: string | null;
};

/**
 * PIX gerado (pix_qrcode NOT NULL), não pago, não cancelado, não falho,
 * criado dentro da janela do step, e que ainda não recebeu este step.
 */
async function listEligibleRecipients(step: RecoveryStep): Promise<RecoveryRecipient[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    transaction_id: string;
    user_id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT
       t.id               AS transaction_id,
       t.user_id,
       u.email,
       u.name
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN pix_recovery_sends prs
       ON prs.transaction_id = t.id AND prs.step = $1
     WHERE
       t.pix_qrcode IS NOT NULL
       AND t.status NOT IN ('paid', 'approved', 'completed', 'confirmed',
                            'cancelled', 'canceled', 'refunded', 'failed')
       AND t.created_at >= now() - ($3 * INTERVAL '1 minute')
       AND t.created_at <  now() - ($2 * INTERVAL '1 minute')
       AND u.email IS NOT NULL AND trim(u.email) <> ''
       AND prs.transaction_id IS NULL
     ORDER BY t.created_at ASC
     LIMIT 500`,
    [step.id, step.minAgo, step.maxAgo],
  );
  return rows.map((r) => ({
    transactionId: r.transaction_id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
  }));
}

async function recordRecoverySend(input: {
  transactionId: string;
  step: PixRecoveryStepId;
  userId: string;
  emailNormalized: string;
  resendId: string | null;
}): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `INSERT INTO pix_recovery_sends (transaction_id, step, user_id, email_normalized, resend_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (transaction_id, step) DO NOTHING`,
    [input.transactionId, input.step, input.userId, input.emailNormalized, input.resendId],
  );
  return (rowCount ?? 0) > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────
// Step runner
// ────────────────────────────────────────────────

export type RunStepResult = {
  stepId: PixRecoveryStepId;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
};

async function runRecoveryStep(
  step: RecoveryStep,
  opts: { dryRun: boolean },
): Promise<RunStepResult> {
  const builder = PIX_RECOVERY_EMAIL_BUILDERS[step.id];
  const recipients = await listEligibleRecipients(step);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  if (recipients.length > 0) {
    console.info("[recovery] step inicio", {
      step: step.id,
      eligible: recipients.length,
      dryRun: opts.dryRun,
    });
  }

  for (const recipient of recipients) {
    const parsed = parseTransactionalEmail(recipient.email);
    if (!parsed.ok) {
      skipped += 1;
      continue;
    }

    if (opts.dryRun) {
      console.info("[recovery] dry-run —", step.id, parsed.email);
      sent += 1;
      continue;
    }

    const email = builder({ recipientName: recipient.name });

    const result = await sendEmail({
      to: parsed.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: EMAIL_TAG_PIX_RECOVERY_COPA,
      kind: "marketing",
    });

    if (!result.ok) {
      failed += 1;
      console.error("[recovery] falha", {
        step: step.id,
        email: parsed.email,
        error: result.error,
      });
      continue;
    }

    const recorded = await recordRecoverySend({
      transactionId: recipient.transactionId,
      step: step.id,
      userId: recipient.userId,
      emailNormalized: parsed.email,
      resendId: "id" in result ? result.id : null,
    });

    if (!recorded) {
      skipped += 1;
      continue;
    }

    sent += 1;
    await sleep(SEND_DELAY_MS);
  }

  if (recipients.length > 0) {
    console.info("[recovery] step lote", { step: step.id, sent, skipped, failed, total: recipients.length });
  }

  return { stepId: step.id, sent, skipped, failed, total: recipients.length };
}

// ────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────

export type RunPixRecoveryResult = {
  dryRun: boolean;
  steps: RunStepResult[];
};

/**
 * Verifica todos os 8 steps e despacha os que têm destinatários elegíveis.
 * Cada step tem advisory lock próprio — runs concorrentes são no-ops.
 */
export async function runPixRecoveryCopa(opts?: {
  dryRun?: boolean;
}): Promise<RunPixRecoveryResult> {
  const dryRun = Boolean(opts?.dryRun);
  await ensurePixRecoveryTables();

  const results: RunStepResult[] = [];

  for (const step of RECOVERY_STEPS) {
    const stepResult = await tryWithFootballAdvisoryLock(
      step.advisoryLock,
      () => runRecoveryStep(step, { dryRun }),
    );

    if (stepResult == null) {
      results.push({ stepId: step.id, sent: 0, skipped: 0, failed: 0, total: 0 });
      console.info("[recovery] step locked (outro processo)", step.id);
    } else {
      results.push(stepResult);
    }
  }

  return { dryRun, steps: results };
}
