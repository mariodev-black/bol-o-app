import { parseTransactionalEmail } from "@/lib/email/address";
import { getCampaignSendDelayMs } from "@/lib/email/deliverability";
import type { ResendEmailCategory } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { tryWithFootballAdvisoryLock } from "@/lib/football/advisory-locks";
import { getPool } from "@/lib/db";

/**
 * Motor genérico de drips de CRM disparados por evento (compra, cadastro).
 * Cada fluxo define seus steps (janela de tempo + público + template).
 * Dedup por (flow_key, step, dedup_id) na tabela email_drip_sends.
 */

export type DripRecipient = {
  /** Chave de dedup: user_id (ou outro id estável do evento). */
  dedupId: string;
  userId: string | null;
  email: string;
  name: string | null;
};

export type DripEmail = { subject: string; html: string; text: string };

export type DripStep = {
  id: string;
  advisoryLock: number;
  /** Público elegível AGORA para este step (já filtra janela + dedup + unsubscribe). */
  listRecipients: () => Promise<DripRecipient[]>;
  build: (params: { recipientName?: string | null }) => DripEmail;
};

export type DripFlow = {
  flowKey: string;
  category: ResendEmailCategory;
  steps: DripStep[];
};

const SEND_DELAY_MS = getCampaignSendDelayMs();

let dripTableReady: Promise<void> | null = null;

export function ensureDripTable(): Promise<void> {
  if (!dripTableReady) {
    dripTableReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_drip_sends (
          flow_key         TEXT NOT NULL,
          step             TEXT NOT NULL,
          dedup_id         TEXT NOT NULL,
          user_id          UUID,
          email_normalized TEXT NOT NULL,
          resend_id        TEXT,
          sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (flow_key, step, dedup_id)
        );
        CREATE INDEX IF NOT EXISTS email_drip_sends_flow_step_idx
          ON email_drip_sends (flow_key, step, sent_at DESC);
      `);
    })().catch((err) => {
      dripTableReady = null;
      throw err;
    });
  }
  return dripTableReady;
}

async function recordDripSend(input: {
  flowKey: string;
  step: string;
  dedupId: string;
  userId: string | null;
  emailNormalized: string;
  resendId: string | null;
}): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `INSERT INTO email_drip_sends (flow_key, step, dedup_id, user_id, email_normalized, resend_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (flow_key, step, dedup_id) DO NOTHING`,
    [
      input.flowKey,
      input.step,
      input.dedupId,
      input.userId,
      input.emailNormalized,
      input.resendId,
    ],
  );
  return (rowCount ?? 0) > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RunDripStepResult = {
  stepId: string;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
};

export type RunDripFlowResult = {
  flowKey: string;
  dryRun: boolean;
  steps: RunDripStepResult[];
};

async function runStep(
  flow: DripFlow,
  step: DripStep,
  opts: { dryRun: boolean },
): Promise<RunDripStepResult> {
  const recipients = await step.listRecipients();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  if (recipients.length > 0) {
    console.info("[drip] step inicio", {
      flow: flow.flowKey,
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
      sent += 1;
      continue;
    }

    const email = step.build({ recipientName: recipient.name });
    const result = await sendEmail({
      to: parsed.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: flow.category,
      kind: "marketing",
    });

    if (!result.ok) {
      failed += 1;
      console.error("[drip] falha", {
        flow: flow.flowKey,
        step: step.id,
        email: parsed.email,
        error: result.error,
      });
      continue;
    }

    const recorded = await recordDripSend({
      flowKey: flow.flowKey,
      step: step.id,
      dedupId: recipient.dedupId,
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
    console.info("[drip] step lote", {
      flow: flow.flowKey,
      step: step.id,
      sent,
      skipped,
      failed,
      total: recipients.length,
    });
  }

  return { stepId: step.id, sent, skipped, failed, total: recipients.length };
}

/** Roda todos os steps do fluxo. Cada step tem advisory lock próprio (concorrência segura). */
export async function runDripFlow(
  flow: DripFlow,
  opts?: { dryRun?: boolean },
): Promise<RunDripFlowResult> {
  const dryRun = Boolean(opts?.dryRun);
  await ensureDripTable();

  const steps: RunDripStepResult[] = [];
  for (const step of flow.steps) {
    const result = await tryWithFootballAdvisoryLock(step.advisoryLock, () =>
      runStep(flow, step, { dryRun }),
    );
    if (result == null) {
      steps.push({ stepId: step.id, sent: 0, skipped: 0, failed: 0, total: 0 });
      console.info("[drip] step locked (outro processo)", flow.flowKey, step.id);
    } else {
      steps.push(result);
    }
  }

  return { flowKey: flow.flowKey, dryRun, steps };
}
