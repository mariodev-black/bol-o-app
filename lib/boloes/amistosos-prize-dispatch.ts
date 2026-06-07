import { parseTransactionalEmail } from "@/lib/email/address";
import {
  hasEmailCampaignSend,
  markEmailCampaignRunCompleted,
  markEmailCampaignRunStarted,
  tryRecordEmailCampaignSend,
} from "@/lib/email/campaign-sends";
import { getCampaignSendDelayMs } from "@/lib/email/deliverability";
import { getEmailBoloesUrl } from "@/lib/email/config";
import { EMAIL_TAG_ADMIN_BROADCAST } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { buildPrizeReleasedEmail } from "@/lib/email/templates/prize-released";
import { escapeEmailHtml } from "@/lib/email/recipient";
import {
  AMISTOSOS_FRIENDLIES_DISPLAY_NAME,
  AMISTOSOS_FRIENDLIES_ROUND,
  getAmistososFriendliesCompetitionId,
} from "@/lib/football/amistosos-friendlies";
import { dispatchAdminBroadcast } from "@/lib/notifications/admin-dispatch";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import { buildLeaderboardExtraForCompAndRound } from "@/lib/ranking/leaderboard";

export const AMISTOSOS_PRIZE_AMOUNTS_BRL = {
  1: "R$ 1.000",
  2: "R$ 500",
  3: "R$ 300",
} as const;

export type AmistososPrizeWinner = {
  position: 1 | 2 | 3;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
};

export type AmistososPrizeDispatchResult = {
  batchId: string;
  winners: AmistososPrizeWinner[];
  email: { sent: number; failed: number; skipped: number };
  app: { created: number };
  push: { sent: number; failed: number };
};

function prizeAmountForPosition(position: number): string | null {
  if (position === 1) return AMISTOSOS_PRIZE_AMOUNTS_BRL[1];
  if (position === 2) return AMISTOSOS_PRIZE_AMOUNTS_BRL[2];
  if (position === 3) return AMISTOSOS_PRIZE_AMOUNTS_BRL[3];
  return null;
}

function rankLabel(position: number): string {
  return `${position}º lugar`;
}

export function buildAmistososWinnerNotificationCopy(
  winner: AmistososPrizeWinner,
): {
  title: string;
  preview: string;
  body: string;
  prizeLabel: string;
} {
  const prizeLabel = prizeAmountForPosition(winner.position) ?? "—";
  const title = `Parabéns! ${rankLabel(winner.position)} no ${AMISTOSOS_FRIENDLIES_DISPLAY_NAME}`;
  const preview = `Você ganhou ${prizeLabel} com ${winner.totalPoints} pontos no bolão.`;
  const body = [
    `O ${AMISTOSOS_FRIENDLIES_DISPLAY_NAME} foi finalizado e você ficou em ${winner.position}º lugar com ${winner.totalPoints} pontos! 🏆`,
    "",
    `Sua premiação: ${prizeLabel}.`,
    "",
    "Nossa equipe entrará em contato em breve para liberar o valor. Acompanhe sua colocação no app.",
  ].join("\n");

  return { title, preview, body, prizeLabel };
}

export async function resolveAmistososTopWinners(
  limit = 3,
): Promise<AmistososPrizeWinner[]> {
  const extraComp = getAmistososFriendliesCompetitionId();
  const { rows } = await buildLeaderboardExtraForCompAndRound(
    extraComp,
    AMISTOSOS_FRIENDLIES_ROUND,
  );

  const winners: AmistososPrizeWinner[] = [];
  for (const row of rows) {
    if (row.isFiller) continue;
    if (row.pos > limit) break;
    if (row.pos < 1 || row.pos > 3) continue;
    winners.push({
      position: row.pos as 1 | 2 | 3,
      ticketId: row.ticketId,
      userId: row.userId,
      displayName: row.displayName,
      totalPoints: row.totalPoints,
      exactCount: row.exactCount,
    });
  }
  return winners;
}

async function sendAmistososWinnerEmail(input: {
  campaignId: string;
  winner: AmistososPrizeWinner;
  recipientName: string | null;
  email: string;
}): Promise<"sent" | "failed" | "skipped"> {
  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) return "skipped";

  if (await hasEmailCampaignSend(input.campaignId, parsed.email)) {
    return "skipped";
  }

  const copy = buildAmistososWinnerNotificationCopy(input.winner);
  const built = buildPrizeReleasedEmail({
    recipientName: input.recipientName,
    headline: "Premiação liberada — Amistosos",
    introHtml: escapeEmailHtml(copy.body).replace(/\n/g, "<br />"),
    tiers: [
      {
        rankLabel: rankLabel(input.winner.position),
        amountLabel: copy.prizeLabel,
      },
    ],
    progressNoteHtml:
      '<span style="font-size:18px;line-height:1;">🏆</span> Bolão dos Amistosos — premiação do pódio (1º, 2º e 3º).',
    closingHtml:
      "Parabéns pela colocação! Em breve nossa equipe confirma a liberação do prêmio.",
    ctaLabel: "Ver bolões",
    ctaHref: getEmailBoloesUrl(),
  });

  const result = await sendEmail({
    to: parsed.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
    category: EMAIL_TAG_ADMIN_BROADCAST,
    kind: "marketing",
  });

  if (!result.ok) return "failed";

  const resendId = "id" in result ? result.id : null;
  await tryRecordEmailCampaignSend({
    campaignId: input.campaignId,
    emailNormalized: parsed.email,
    userId: input.winner.userId,
    resendId,
  });

  return "sent";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchAmistososPrizeNotifications(input: {
  winners: AmistososPrizeWinner[];
  channels: AdminBroadcastChannel[];
  dryRun?: boolean;
}): Promise<AmistososPrizeDispatchResult> {
  const batchId = crypto.randomUUID();
  const channels = [...new Set(input.channels)];
  const dryRun = input.dryRun === true;

  const empty: AmistososPrizeDispatchResult = {
    batchId,
    winners: input.winners,
    email: { sent: 0, failed: 0, skipped: 0 },
    app: { created: 0 },
    push: { sent: 0, failed: 0 },
  };

  if (input.winners.length === 0 || channels.length === 0) {
    return empty;
  }

  if (dryRun) {
    console.info(
      `[amistosos:prizes] dry-run: ${input.winners.length} ganhador(es) via ${channels.join(", ")}`,
    );
    return empty;
  }

  const { getPool } = await import("@/lib/db");
  const pool = getPool();
  const userIds = input.winners.map((w) => w.userId);
  const { rows: users } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT id::text, email, name FROM users WHERE id = ANY($1::uuid[])`,
    [userIds],
  );
  const userById = new Map(users.map((u) => [u.id, u]));

  const campaignId = `amistosos_prizes_${batchId}`;
  const delayMs = getCampaignSendDelayMs();
  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let appCreated = 0;
  let pushSent = 0;
  let pushFailed = 0;

  if (channels.includes("email")) {
    await markEmailCampaignRunStarted(campaignId);
  }

  for (const winner of input.winners) {
    const user = userById.get(winner.userId);
    const copy = buildAmistososWinnerNotificationCopy(winner);
    const notifyChannels = channels.filter((c) => c !== "email");

    if (channels.includes("email") && user?.email) {
      const status = await sendAmistososWinnerEmail({
        campaignId,
        winner,
        recipientName: user.name,
        email: user.email,
      });
      if (status === "sent") emailSent += 1;
      else if (status === "failed") emailFailed += 1;
      else emailSkipped += 1;
      if (delayMs > 0) await sleep(delayMs);
    }

    if (notifyChannels.length > 0) {
      const notify = await dispatchAdminBroadcast({
        batchId: crypto.randomUUID(),
        userIds: [winner.userId],
        channels: notifyChannels,
        title: copy.title,
        preview: copy.preview,
        body: copy.body,
        pushTitle: copy.title,
        pushPreview: copy.preview,
        pushUrl: "/boloes",
        emailButton: null,
        emailLayout: "default",
        syncEmail: true,
      });
      appCreated += notify.app?.created ?? 0;
      pushSent += notify.push?.sent ?? 0;
      pushFailed += notify.push?.failed ?? 0;
    }
  }

  if (channels.includes("email")) {
    await markEmailCampaignRunCompleted({
      campaignId,
      sentCount: emailSent,
      skippedCount: emailSkipped,
      failedCount: emailFailed,
      lastError: emailFailed > 0 ? "some sends failed" : null,
    });
  }

  return {
    batchId,
    winners: input.winners,
    email: { sent: emailSent, failed: emailFailed, skipped: emailSkipped },
    app: { created: appCreated },
    push: { sent: pushSent, failed: pushFailed },
  };
}
