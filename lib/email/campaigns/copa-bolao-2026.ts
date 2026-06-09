import { parseTransactionalEmail } from "@/lib/email/address";
import {
  countEmailCampaignSends,
  ensureEmailCampaignTables,
  listCampaignRecipients,
  loadSentEmailSet,
  markEmailCampaignRunCompleted,
  markEmailCampaignRunStarted,
  tryRecordEmailCampaignSend,
  type CampaignRecipient,
} from "@/lib/email/campaign-sends";
import { getCampaignSendDelayMs } from "@/lib/email/deliverability";
import { EMAIL_TAG_CAMPAIGN_COPA_BOLAO } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { COPA_BOLAO_EMAIL_BUILDERS } from "@/lib/email/templates/copa-bolao-2026";
import { tryWithFootballAdvisoryLock } from "@/lib/football/advisory-locks";

// ────────────────────────────────────────────────
// Slot definitions
// ────────────────────────────────────────────────

export type CopaSlotId =
  | "ter_09h"
  | "ter_12h"
  | "ter_16h"
  | "ter_20h"
  | "qua_09h"
  | "qua_12h"
  | "qua_16h"
  | "qua_20h"
  | "qui_09h"
  | "qui_12h"
  | "qui_16h"
  | "qui_20h";

export const COPA_SLOT_IDS: CopaSlotId[] = [
  "ter_09h", "ter_12h", "ter_16h", "ter_20h",
  "qua_09h", "qua_12h", "qua_16h", "qua_20h",
  "qui_09h", "qui_12h", "qui_16h", "qui_20h",
];

type CopaBolaoSlot = {
  slotId: CopaSlotId;
  campaignId: string;
  dateBrt: string;
  hour: number;
  advisoryLock: number;
};

const COPA_SLOTS: Record<CopaSlotId, CopaBolaoSlot> = {
  ter_09h: { slotId: "ter_09h", campaignId: "copa_bolao_ter_09h_20260610", dateBrt: "2026-06-10", hour: 9,  advisoryLock: 7_203_110 },
  ter_12h: { slotId: "ter_12h", campaignId: "copa_bolao_ter_12h_20260610", dateBrt: "2026-06-10", hour: 12, advisoryLock: 7_203_111 },
  ter_16h: { slotId: "ter_16h", campaignId: "copa_bolao_ter_16h_20260610", dateBrt: "2026-06-10", hour: 16, advisoryLock: 7_203_112 },
  ter_20h: { slotId: "ter_20h", campaignId: "copa_bolao_ter_20h_20260610", dateBrt: "2026-06-10", hour: 20, advisoryLock: 7_203_113 },
  qua_09h: { slotId: "qua_09h", campaignId: "copa_bolao_qua_09h_20260611", dateBrt: "2026-06-11", hour: 9,  advisoryLock: 7_203_114 },
  qua_12h: { slotId: "qua_12h", campaignId: "copa_bolao_qua_12h_20260611", dateBrt: "2026-06-11", hour: 12, advisoryLock: 7_203_115 },
  qua_16h: { slotId: "qua_16h", campaignId: "copa_bolao_qua_16h_20260611", dateBrt: "2026-06-11", hour: 16, advisoryLock: 7_203_116 },
  qua_20h: { slotId: "qua_20h", campaignId: "copa_bolao_qua_20h_20260611", dateBrt: "2026-06-11", hour: 20, advisoryLock: 7_203_117 },
  qui_09h: { slotId: "qui_09h", campaignId: "copa_bolao_qui_09h_20260612", dateBrt: "2026-06-12", hour: 9,  advisoryLock: 7_203_118 },
  qui_12h: { slotId: "qui_12h", campaignId: "copa_bolao_qui_12h_20260612", dateBrt: "2026-06-12", hour: 12, advisoryLock: 7_203_119 },
  qui_16h: { slotId: "qui_16h", campaignId: "copa_bolao_qui_16h_20260612", dateBrt: "2026-06-12", hour: 16, advisoryLock: 7_203_120 },
  qui_20h: { slotId: "qui_20h", campaignId: "copa_bolao_qui_20h_20260612", dateBrt: "2026-06-12", hour: 20, advisoryLock: 7_203_121 },
};

const SEND_DELAY_MS = getCampaignSendDelayMs();

// ────────────────────────────────────────────────
// Helpers BRT
// ────────────────────────────────────────────────

function brtYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function brtHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countPendingRecipients(
  recipients: CampaignRecipient[],
  alreadySent: Set<string>,
): number {
  let pending = 0;
  for (const r of recipients) {
    const parsed = parseTransactionalEmail(r.email);
    if (parsed.ok && !alreadySent.has(parsed.email)) pending += 1;
  }
  return pending;
}

// ────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────

export function isCopaBolaoSlotId(value: string): value is CopaSlotId {
  return (COPA_SLOT_IDS as string[]).includes(value);
}

/** Janela ativa: mesmo dia BRT, mesma hora BRT. Retries dentro da hora passam. */
export function isCopaBolaoSlotWindow(slotId: CopaSlotId): boolean {
  const slot = COPA_SLOTS[slotId];
  if (brtYmd() !== slot.dateBrt) return false;
  return brtHour() === slot.hour;
}

export type RunCopaCampaignResult = {
  ran: boolean;
  reason?: string;
  sent: number;
  skipped: number;
  failed: number;
  totalRecipients: number;
};

/**
 * Força envio imediato ignorando janela de horário (mantém dedupe por e-mail).
 * Use para testes ou disparo manual via admin.
 */
export async function dispatchCopaBolaoSlotToAllUsers(
  slotId: CopaSlotId,
  opts?: { dryRun?: boolean },
): Promise<RunCopaCampaignResult> {
  return runCopaBolaoSlot(slotId, { force: true, dryRun: opts?.dryRun });
}

/**
 * Dispara o slot se estiver dentro da janela de horário agendado.
 * Chamado pelo cron — idempotente, dedupe por e-mail no banco.
 */
export async function runCopaBolaoSlot(
  slotId: CopaSlotId,
  opts?: { force?: boolean; dryRun?: boolean },
): Promise<RunCopaCampaignResult> {
  const slot = COPA_SLOTS[slotId];
  const force = Boolean(opts?.force);
  const dryRun = Boolean(opts?.dryRun);

  await ensureEmailCampaignTables();

  if (!force && !dryRun && !isCopaBolaoSlotWindow(slotId)) {
    return {
      ran: false,
      reason: "fora-do-horario-agendado",
      sent: 0,
      skipped: 0,
      failed: 0,
      totalRecipients: 0,
    };
  }

  const recipients = await listCampaignRecipients();
  const alreadySent = await loadSentEmailSet(slot.campaignId);
  const pending = countPendingRecipients(recipients, alreadySent);

  if (!force && !dryRun && pending === 0) {
    return {
      ran: false,
      reason: "campanha-ja-concluida",
      sent: 0,
      skipped: recipients.length,
      failed: 0,
      totalRecipients: recipients.length,
    };
  }

  const locked = await tryWithFootballAdvisoryLock(
    slot.advisoryLock,
    async () => {
      if (!dryRun) await markEmailCampaignRunStarted(slot.campaignId);
      return runCopaBolaoSlotBatch({ slot, recipients, dryRun, alreadySent });
    },
  );

  if (locked == null) {
    return {
      ran: false,
      reason: "outro-processo-enviando",
      sent: 0,
      skipped: 0,
      failed: 0,
      totalRecipients: recipients.length,
    };
  }

  return locked;
}

// ────────────────────────────────────────────────
// Batch sender
// ────────────────────────────────────────────────

async function runCopaBolaoSlotBatch(input: {
  slot: CopaBolaoSlot;
  recipients: CampaignRecipient[];
  dryRun: boolean;
  alreadySent: Set<string>;
}): Promise<RunCopaCampaignResult> {
  const { slot, recipients, dryRun, alreadySent } = input;
  const builder = COPA_BOLAO_EMAIL_BUILDERS[slot.slotId];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let lastError: string | null = null;

  console.info("[campaign] copa-bolao inicio", {
    slot: slot.slotId,
    campaignId: slot.campaignId,
    total: recipients.length,
    pendentes: countPendingRecipients(recipients, alreadySent),
    jaEnviados: alreadySent.size,
    dryRun,
  });

  for (const recipient of recipients) {
    const parsed = parseTransactionalEmail(recipient.email);
    if (!parsed.ok) {
      skipped += 1;
      continue;
    }

    if (alreadySent.has(parsed.email)) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.info("[campaign] dry-run —", parsed.email);
      sent += 1;
      continue;
    }

    const email = builder({ recipientName: recipient.name });

    const result = await sendEmail({
      to: parsed.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: EMAIL_TAG_CAMPAIGN_COPA_BOLAO,
      kind: "marketing",
    });

    if (!result.ok) {
      failed += 1;
      lastError = result.error;
      console.error("[campaign] falha", {
        slot: slot.slotId,
        email: parsed.email,
        error: result.error,
      });
      continue;
    }

    const recorded = await tryRecordEmailCampaignSend({
      campaignId: slot.campaignId,
      emailNormalized: parsed.email,
      userId: recipient.userId,
      resendId: "id" in result ? result.id : null,
    });

    if (!recorded) {
      skipped += 1;
      alreadySent.add(parsed.email);
      continue;
    }

    alreadySent.add(parsed.email);
    sent += 1;
    if (sent % 25 === 0) {
      console.info("[campaign] progresso", {
        slot: slot.slotId,
        sent,
        total: recipients.length,
      });
    }
    await sleep(SEND_DELAY_MS);
  }

  const fullyDone =
    dryRun || countPendingRecipients(recipients, alreadySent) === 0;

  if (!dryRun && fullyDone) {
    const totalSent = await countEmailCampaignSends(slot.campaignId);
    await markEmailCampaignRunCompleted({
      campaignId: slot.campaignId,
      sentCount: totalSent,
      skippedCount: Math.max(0, recipients.length - totalSent),
      failedCount: failed,
      lastError,
    });
  }

  console.info("[campaign] copa-bolao lote", {
    slot: slot.slotId,
    sent,
    skipped,
    failed,
    total: recipients.length,
    dryRun,
    fullyDone,
  });

  return {
    ran: true,
    sent,
    skipped,
    failed,
    totalRecipients: recipients.length,
    reason: fullyDone ? undefined : "continua-no-proximo-cron",
  };
}
