import { isAllowedAdminBroadcastButtonUrl } from "@/lib/email/resolve-button-url";
import { PWA_START_PATH } from "@/lib/pwa/config";
import {
  sendAdminBroadcastEmails,
  type AdminBroadcastEmailLayout,
} from "@/lib/notifications/admin-broadcast-email";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import type { AdminDispatchResult } from "@/lib/notifications/admin-broadcast-shared";
import {
  createAdminBroadcastNotifications,
  recordAdminBroadcastBatch,
  updateAdminBroadcastBatchEmailStats,
} from "@/lib/notifications/admin-broadcast";
import { sendPushToUserIds } from "@/lib/push/send";

const EMAIL_ASYNC_THRESHOLD = 30;

export type AdminDispatchInput = {
  batchId: string;
  userIds: string[];
  channels: AdminBroadcastChannel[];
  title: string;
  preview: string;
  body: string;
  pushUrl: string;
  emailButton: { label: string; url: string } | null;
  emailLayout?: AdminBroadcastEmailLayout;
};

export async function dispatchAdminBroadcast(
  input: AdminDispatchInput,
): Promise<AdminDispatchResult> {
  const { batchId, userIds, channels, title, preview, body } = input;

  const willQueueEmail =
    channels.includes("email") && userIds.length > EMAIL_ASYNC_THRESHOLD;

  await recordAdminBroadcastBatch({
    batchId,
    channels,
    title,
    preview,
    appRecipients: 0,
    pushSent: 0,
    pushFailed: 0,
    emailSent: 0,
    emailFailed: 0,
    emailQueued: willQueueEmail,
  });

  let appCreated = 0;
  let pushSent = 0;
  let pushFailed = 0;
  let pushExpired = 0;
  let emailSent = 0;
  let emailFailed = 0;
  let emailQueued = false;

  if (channels.includes("app")) {
    const appResult = await createAdminBroadcastNotifications({
      userIds,
      title,
      preview,
      body,
      batchId,
      channels,
    });
    appCreated = appResult.created;
  }

  if (channels.includes("push")) {
    const pushResult = await sendPushToUserIds({
      userIds,
      payload: {
        title,
        body: preview,
        url: input.pushUrl,
        tag: `admin_broadcast:${batchId}`,
      },
    });
    pushSent = pushResult.sent;
    pushFailed = pushResult.failed;
    pushExpired = pushResult.expired;
  }

  if (channels.includes("email")) {
    const runEmail = () =>
      sendAdminBroadcastEmails({
        batchId,
        userIds,
        title,
        preview,
        body,
        button: input.emailButton,
        emailLayout: input.emailLayout,
      });

    if (willQueueEmail) {
      emailQueued = true;
      const { after } = await import("next/server");
      after(async () => {
        try {
          await runEmail();
        } catch (e) {
          console.error("[admin-dispatch] email background", e);
          await updateAdminBroadcastBatchEmailStats(batchId, {
            emailSent: 0,
            emailFailed: userIds.length,
            emailQueued: false,
          });
        }
      });
    } else {
      const emailResult = await runEmail();
      emailSent = emailResult.sent;
      emailFailed = emailResult.failed;
    }
  }

  await recordAdminBroadcastBatch({
    batchId,
    channels,
    title,
    preview,
    appRecipients: appCreated,
    pushSent,
    pushFailed,
    emailSent,
    emailFailed,
    emailQueued,
  });

  return {
    batchId,
    channels,
    requested: userIds.length,
    app: { created: appCreated },
    push: { sent: pushSent, failed: pushFailed, expired: pushExpired },
    email: { sent: emailSent, failed: emailFailed, queued: emailQueued },
  };
}

/** Botão do e-mail: só inclui CTA se texto e link estiverem preenchidos. */
export function parseOptionalAdminEmailButton(
  label: string,
  url: string,
): { button: { label: string; url: string } | null; error: string | null } {
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();

  if (!trimmedLabel && !trimmedUrl) {
    return { button: null, error: null };
  }

  if (!trimmedLabel || !trimmedUrl) {
    return { button: null, error: null };
  }

  if (trimmedLabel.length < 2) {
    return {
      button: null,
      error: "Texto do botão deve ter pelo menos 2 caracteres",
    };
  }

  if (!isAllowedAdminBroadcastButtonUrl(trimmedUrl)) {
    return {
      button: null,
      error: "Link do botão inválido. Use um caminho do app (ex.: /boloes)",
    };
  }

  return { button: { label: trimmedLabel, url: trimmedUrl }, error: null };
}

export function resolveAdminPushPath(raw: string): string {
  const trimmed = raw.trim();
  return trimmed || PWA_START_PATH;
}

export function validateAdminDispatchInput(input: {
  channels: AdminBroadcastChannel[];
  title: string;
  preview: string;
  body: string;
  pushUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  includeEmailButton?: boolean;
}): string | null {
  if (input.channels.length === 0) {
    return "Selecione pelo menos um canal de envio";
  }

  if (input.title.length < 3) {
    return "Titulo deve ter pelo menos 3 caracteres";
  }

  const needsPreview =
    input.channels.includes("app") ||
    input.channels.includes("push") ||
    input.channels.includes("email");

  if (needsPreview && input.preview.length < 5) {
    return "Resumo deve ter pelo menos 5 caracteres";
  }

  if (input.channels.includes("app") && input.body.length < 10) {
    return "Mensagem completa deve ter pelo menos 10 caracteres (sininho)";
  }

  if (input.channels.includes("push")) {
    const pushPath = resolveAdminPushPath(input.pushUrl);
    if (!isAllowedAdminBroadcastButtonUrl(pushPath)) {
      return "Link do push invalido. Use um caminho do app (ex.: /boloes)";
    }
  }

  if (input.channels.includes("email")) {
    if (input.body.length < 10) {
      return "Mensagem completa deve ter pelo menos 10 caracteres (e-mail)";
    }
    if (input.includeEmailButton) {
      const parsed = parseOptionalAdminEmailButton(
        input.buttonLabel,
        input.buttonUrl,
      );
      if (parsed.error) return parsed.error;
    }
  }

  return null;
}
