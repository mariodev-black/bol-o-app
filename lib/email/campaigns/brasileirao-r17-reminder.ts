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
import { EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17 } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { buildBrasileiraoR17ReminderEmail } from "@/lib/email/templates/brasileirao-r17-reminder";
import { tryWithFootballAdvisoryLock } from "@/lib/football/advisory-locks";

const ADVISORY_LOCK_BRASILEIRAO_R17_EMAIL = 7_202_612;

/** Identificador único — não reenvia o mesmo e-mail para a mesma campanha. */
export const BRASILEIRAO_R17_CAMPAIGN_ID = "brasileirao_r17_20260523";

/** Disparo agendado: 23/05/2026 às 09:12 (America/Sao_Paulo). */
export const BRASILEIRAO_R17_SCHEDULE = {
  dateBrt: "2026-05-23",
  hour: 9,
  minute: 12,
} as const;

const SEND_DELAY_MS = getCampaignSendDelayMs();

function brtYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function brtHm(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10),
    minute: Number.parseInt(
      parts.find((p) => p.type === "minute")?.value ?? "0",
      10,
    ),
  };
}

/** Dia da campanha, a partir de 09:12 BRT (crons extras no mesmo dia retomam o envio). */
export function isBrasileiraoR17ScheduleWindow(now = new Date()): boolean {
  void now;
  const today = brtYmd();
  if (today !== BRASILEIRAO_R17_SCHEDULE.dateBrt) return false;
  const { hour, minute } = brtHm();
  if (hour < BRASILEIRAO_R17_SCHEDULE.hour) return false;
  if (hour === BRASILEIRAO_R17_SCHEDULE.hour && minute < BRASILEIRAO_R17_SCHEDULE.minute) {
    return false;
  }
  return true;
}

function countPendingRecipients(
  recipients: CampaignRecipient[],
  alreadySent: Set<string>,
): number {
  let pending = 0;
  for (const recipient of recipients) {
    const parsed = parseTransactionalEmail(recipient.email);
    if (!parsed.ok) continue;
    if (!alreadySent.has(parsed.email)) pending += 1;
  }
  return pending;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RunBrasileiraoR17CampaignResult = {
  ran: boolean;
  reason?: string;
  sent: number;
  skipped: number;
  failed: number;
  totalRecipients: number;
};

/**
 * Dispara agora o e-mail da 17ª rodada para **todos** os usuários com e-mail cadastrado.
 * Não reenvia quem já está em `email_campaign_sends` para esta campanha.
 */
export async function dispatchBrasileiraoR17EmailToAllUsers(opts?: {
  dryRun?: boolean;
}): Promise<RunBrasileiraoR17CampaignResult> {
  return runBrasileiraoR17Campaign({ force: true, dryRun: opts?.dryRun });
}

/**
 * Envia a campanha para todos os e-mails cadastrados (1x por e-mail).
 * `force` ignora horário, mas mantém dedupe por e-mail.
 */
export async function runBrasileiraoR17Campaign(opts?: {
  force?: boolean;
  dryRun?: boolean;
}): Promise<RunBrasileiraoR17CampaignResult> {
  const force = Boolean(opts?.force);
  const dryRun = Boolean(opts?.dryRun);

  await ensureEmailCampaignTables();

  if (!force && !dryRun && !isBrasileiraoR17ScheduleWindow()) {
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
  const alreadySent = await loadSentEmailSet(BRASILEIRAO_R17_CAMPAIGN_ID);
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
    ADVISORY_LOCK_BRASILEIRAO_R17_EMAIL,
    async () => {
      if (!dryRun) {
        await markEmailCampaignRunStarted(BRASILEIRAO_R17_CAMPAIGN_ID);
      }
      return runBrasileiraoR17CampaignBatch({
        recipients,
        dryRun,
        alreadySent,
      });
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

async function runBrasileiraoR17CampaignBatch(input: {
  recipients: CampaignRecipient[];
  dryRun: boolean;
  alreadySent: Set<string>;
}): Promise<RunBrasileiraoR17CampaignResult> {
  const { recipients, dryRun, alreadySent } = input;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let lastError: string | null = null;

  console.info("[campaign] destinatários", {
    total: recipients.length,
    pendentes: countPendingRecipients(recipients, alreadySent),
    jaEnviados: alreadySent.size,
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

    const personalized = buildBrasileiraoR17ReminderEmail({
      recipientName: recipient.name,
    });

    const result = await sendEmail({
      to: parsed.email,
      subject: personalized.subject,
      html: personalized.html,
      text: personalized.text,
      category: EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17,
      kind: "marketing",
    });

    if (!result.ok) {
      failed += 1;
      lastError = result.error;
      console.error("[campaign] falha", {
        email: parsed.email,
        error: result.error,
      });
      continue;
    }

    const recorded = await tryRecordEmailCampaignSend({
      campaignId: BRASILEIRAO_R17_CAMPAIGN_ID,
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
      console.info("[campaign] progresso", { sent, total: recipients.length });
    }
    await sleep(SEND_DELAY_MS);
  }

  const fullyDone =
    dryRun || countPendingRecipients(recipients, alreadySent) === 0;

  if (!dryRun && fullyDone) {
    const totalSent = await countEmailCampaignSends(BRASILEIRAO_R17_CAMPAIGN_ID);
    await markEmailCampaignRunCompleted({
      campaignId: BRASILEIRAO_R17_CAMPAIGN_ID,
      sentCount: totalSent,
      skippedCount: Math.max(0, recipients.length - totalSent),
      failedCount: failed,
      lastError,
    });
  }

  console.info("[campaign] brasileirao-r17 lote", {
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
