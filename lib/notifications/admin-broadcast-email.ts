import { parseTransactionalEmail } from "@/lib/email/address";
import {
  hasEmailCampaignSend,
  markEmailCampaignRunCompleted,
  markEmailCampaignRunStarted,
  tryRecordEmailCampaignSend,
} from "@/lib/email/campaign-sends";
import { getCampaignSendDelayMs } from "@/lib/email/deliverability";
import { EMAIL_TAG_ADMIN_BROADCAST } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import type { AdminBroadcastEmailButton } from "@/lib/email/templates/admin-broadcast";
import { buildAdminBroadcastEmail } from "@/lib/email/templates/admin-broadcast";
import { getPool } from "@/lib/db";
import { updateAdminBroadcastBatchEmailStats } from "@/lib/notifications/admin-broadcast";

export type AdminBroadcastEmailRecipient = {
  userId: string;
  email: string;
  name: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function adminBroadcastEmailCampaignId(batchId: string): string {
  return `admin_notif_${batchId}`;
}

export async function listAdminBroadcastEmailRecipients(
  userIds: string[],
): Promise<AdminBroadcastEmailRecipient[]> {
  if (userIds.length === 0) return [];

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT id, email, name
     FROM users
     WHERE id = ANY($1::uuid[])
       AND email IS NOT NULL AND trim(email) <> ''`,
    [userIds],
  );

  const byEmail = new Map<string, AdminBroadcastEmailRecipient>();
  for (const row of rows) {
    const parsed = parseTransactionalEmail(row.email);
    if (!parsed.ok) continue;
    if (!byEmail.has(parsed.email)) {
      byEmail.set(parsed.email, {
        userId: row.id,
        email: row.email,
        name: row.name,
      });
    }
  }
  return [...byEmail.values()];
}

export async function sendAdminBroadcastEmails(input: {
  batchId: string;
  userIds: string[];
  title: string;
  preview: string;
  body: string;
  button: AdminBroadcastEmailButton;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const recipients = await listAdminBroadcastEmailRecipients(input.userIds);
  const campaignId = adminBroadcastEmailCampaignId(input.batchId);
  const delayMs = getCampaignSendDelayMs();

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let lastError: string | null = null;

  if (recipients.length === 0) {
    await updateAdminBroadcastBatchEmailStats(input.batchId, {
      emailSent: 0,
      emailFailed: 0,
      emailQueued: false,
    });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  await markEmailCampaignRunStarted(campaignId);

  for (const recipient of recipients) {
    const parsed = parseTransactionalEmail(recipient.email);
    if (!parsed.ok) {
      skipped += 1;
      continue;
    }

    if (await hasEmailCampaignSend(campaignId, parsed.email)) {
      skipped += 1;
      continue;
    }

    const built = buildAdminBroadcastEmail({
      recipientName: recipient.name,
      title: input.title,
      preview: input.preview,
      body: input.body,
      button: input.button,
    });

    const result = await sendEmail({
      to: parsed.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      category: EMAIL_TAG_ADMIN_BROADCAST,
      kind: "marketing",
    });

    if (!result.ok) {
      failed += 1;
      lastError = result.error;
      continue;
    }

    const resendId = "id" in result ? result.id : null;
    await tryRecordEmailCampaignSend({
      campaignId,
      emailNormalized: parsed.email,
      userId: recipient.userId,
      resendId,
    });
    sent += 1;

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  await markEmailCampaignRunCompleted({
    campaignId,
    sentCount: sent,
    skippedCount: skipped,
    failedCount: failed,
    lastError,
  });

  await updateAdminBroadcastBatchEmailStats(input.batchId, {
    emailSent: sent,
    emailFailed: failed,
    emailQueued: false,
  });

  return { sent, failed, skipped };
}
