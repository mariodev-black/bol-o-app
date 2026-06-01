import { dispatchAdminBroadcast } from "@/lib/notifications/admin-dispatch";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import {
  getExtraRoundMilhaoGiftCopy,
  grantMilhaoGiftTicketForUser,
  type ExtraRoundMilhaoGiftCampaign,
} from "@/lib/promotions/extra-round-milhao-gift";

export type ExtraRoundMilhaoGiftRecipient = {
  userId: string;
  email: string;
  position: number;
};

export type ExtraRoundMilhaoGiftDispatchResult = {
  campaign: ExtraRoundMilhaoGiftCampaign;
  batchId: string;
  recipients: number;
  tickets: { created: number; alreadyHad: number; failed: number };
  notify: Awaited<ReturnType<typeof dispatchAdminBroadcast>> | null;
};

export async function dispatchExtraRoundMilhaoGiftCampaign(input: {
  campaign: ExtraRoundMilhaoGiftCampaign;
  recipients: ExtraRoundMilhaoGiftRecipient[];
  channels: AdminBroadcastChannel[];
  grantTickets?: boolean;
  dryRun?: boolean;
}): Promise<ExtraRoundMilhaoGiftDispatchResult> {
  const copy = getExtraRoundMilhaoGiftCopy(input.campaign);
  const uniqueByUser = new Map<string, ExtraRoundMilhaoGiftRecipient>();
  for (const r of input.recipients) {
    if (!r.userId?.trim()) continue;
    const prev = uniqueByUser.get(r.userId);
    if (!prev || r.position < prev.position) {
      uniqueByUser.set(r.userId, r);
    }
  }
  const list = [...uniqueByUser.values()];
  const userIds = list.map((r) => r.userId);
  const batchId = crypto.randomUUID();

  let created = 0;
  let alreadyHad = 0;
  let failed = 0;

  if (input.grantTickets !== false && !input.dryRun) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i]!;
      const result = await grantMilhaoGiftTicketForUser(r.userId, input.campaign);
      if (!result.ok) {
        failed += 1;
        console.warn("[milhao-gift] ticket failed", r.userId, result.error);
        continue;
      }
      if (result.alreadyGranted) alreadyHad += 1;
      else created += 1;
      if ((i + 1) % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  } else if (input.grantTickets !== false && input.dryRun) {
    console.info(`[milhao-gift] dry-run: would grant ${list.length} tickets (${input.campaign})`);
  }

  let notify: ExtraRoundMilhaoGiftDispatchResult["notify"] = null;
  if (input.channels.length > 0 && userIds.length > 0 && !input.dryRun) {
    notify = await dispatchAdminBroadcast({
      batchId,
      userIds,
      channels: input.channels,
      title: copy.title,
      preview: copy.preview,
      body: copy.body,
      pushTitle: copy.pushTitle,
      pushPreview: copy.pushPreview,
      pushUrl: "/boloes",
      emailButton: {
        label: copy.emailButtonLabel,
        url: copy.emailButtonUrl,
      },
      emailLayout: "default",
      syncEmail: true,
    });
  } else if (input.dryRun && input.channels.length > 0) {
    console.info(
      `[milhao-gift] dry-run: would notify ${userIds.length} users via ${input.channels.join(",")}`,
    );
  }

  return {
    campaign: input.campaign,
    batchId,
    recipients: list.length,
    tickets: { created, alreadyHad, failed },
    notify,
  };
}
