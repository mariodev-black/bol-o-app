import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  countBroadcastEligibleUsers,
  createAdminBroadcastNotifications,
  listAllBroadcastUserIds,
  parseAdminDeliveryMethod,
  recordAdminBroadcastBatch,
  resolveBroadcastUserIds,
  updateAdminBroadcastBatchEmailStats,
} from "@/lib/notifications/admin-broadcast";
import { isAllowedAdminBroadcastButtonUrl } from "@/lib/email/resolve-button-url";
import { sendAdminBroadcastEmails } from "@/lib/notifications/admin-broadcast-email";
import { sendPushToUserIds } from "@/lib/push/send";

export const runtime = "nodejs";

/** Acima disso o e-mail segue em background (evita timeout no admin). */
const EMAIL_ASYNC_THRESHOLD = 30;

type Body = {
  title?: string;
  preview?: string;
  body?: string;
  audience?: "all" | "selected";
  userIds?: string[];
  /** `app` | `email` | `both` */
  method?: string;
  buttonLabel?: string;
  buttonUrl?: string;
};

function trimField(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const channels = parseAdminDeliveryMethod(payload.method);
  const title = trimField(payload.title, 200);
  const preview = trimField(payload.preview, 500);
  const messageBody = trimField(payload.body, 8000);
  const audience = payload.audience === "selected" ? "selected" : "all";

  if (title.length < 3) {
    return NextResponse.json(
      { error: "Titulo deve ter pelo menos 3 caracteres" },
      { status: 400 },
    );
  }
  if (channels.includes("app") && preview.length < 5) {
    return NextResponse.json(
      { error: "Resumo deve ter pelo menos 5 caracteres (lista do sininho)" },
      { status: 400 },
    );
  }
  if (channels.includes("email") && preview.length < 5) {
    return NextResponse.json(
      { error: "Resumo deve ter pelo menos 5 caracteres (preheader do e-mail)" },
      { status: 400 },
    );
  }
  if (messageBody.length < 10) {
    return NextResponse.json(
      { error: "Mensagem deve ter pelo menos 10 caracteres" },
      { status: 400 },
    );
  }

  const buttonLabel = trimField(payload.buttonLabel, 80);
  const buttonUrl = trimField(payload.buttonUrl, 500);

  if (channels.includes("email")) {
    if (buttonLabel.length < 2) {
      return NextResponse.json(
        { error: "Texto do botao do e-mail deve ter pelo menos 2 caracteres" },
        { status: 400 },
      );
    }
    if (!isAllowedAdminBroadcastButtonUrl(buttonUrl)) {
      return NextResponse.json(
        {
          error:
            "Link do botao invalido. Use um caminho do app (ex.: /palpites) ou URL https.",
        },
        { status: 400 },
      );
    }
  }

  const emailButton = { label: buttonLabel, url: buttonUrl };

  try {
    let userIds: string[] = [];
    if (audience === "all") {
      userIds = await listAllBroadcastUserIds();
    } else {
      const requested = Array.isArray(payload.userIds)
        ? payload.userIds.map((id) => String(id).trim()).filter(Boolean)
        : [];
      if (requested.length === 0) {
        return NextResponse.json(
          { error: "Selecione pelo menos um usuario ou marque todos" },
          { status: 400 },
        );
      }
      userIds = await resolveBroadcastUserIds(requested);
      if (userIds.length === 0) {
        return NextResponse.json(
          { error: "Nenhum usuario valido na selecao (e-mail obrigatorio)" },
          { status: 400 },
        );
      }
      if (userIds.length < requested.length) {
        return NextResponse.json(
          {
            error: `${requested.length - userIds.length} usuario(s) da selecao nao sao validos ou nao tem e-mail`,
          },
          { status: 400 },
        );
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum destinatario elegivel" },
        { status: 400 },
      );
    }

    const batchId = crypto.randomUUID();
    const eligible = await countBroadcastEligibleUsers();
    const willQueueEmail =
      channels.includes("email") && userIds.length > EMAIL_ASYNC_THRESHOLD;

    await recordAdminBroadcastBatch({
      batchId,
      channels,
      title,
      preview,
      appRecipients: 0,
      emailSent: 0,
      emailFailed: 0,
      emailQueued: willQueueEmail,
    });

    let appCreated = 0;
    let pushSent = 0;
    let pushFailed = 0;

    if (channels.includes("app")) {
      const appResult = await createAdminBroadcastNotifications({
        userIds,
        title,
        preview,
        body: messageBody,
        batchId,
        channels,
      });
      appCreated = appResult.created;

      const pushResult = await sendPushToUserIds({
        userIds,
        payload: {
          title,
          body: preview,
          url: "/palpites",
          tag: `admin_broadcast:${batchId}`,
        },
      });
      pushSent = pushResult.sent;
      pushFailed = pushResult.failed;
    }

    let emailSent = 0;
    let emailFailed = 0;
    let emailQueued = false;

    const runEmail = () =>
      sendAdminBroadcastEmails({
        batchId,
        userIds,
        title,
        preview,
        body: messageBody,
        button: emailButton,
      });

    if (channels.includes("email")) {
      if (willQueueEmail) {
        emailQueued = true;
        after(async () => {
          try {
            await runEmail();
          } catch (e) {
            console.error("[admin/notifications/send] email background", e);
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
      emailSent,
      emailFailed,
      emailQueued,
    });

    console.info("[admin/notifications/send]", {
      adminId: auth.admin.id,
      audience,
      channels,
      batchId,
      appCreated,
      pushSent,
      pushFailed,
      emailSent,
      emailFailed,
      emailQueued,
      recipients: userIds.length,
      eligible,
    });

    return NextResponse.json({
      ok: true,
      batchId,
      method: payload.method ?? "app",
      channels,
      audience,
      requested: userIds.length,
      app: { created: appCreated },
      push: { sent: pushSent, failed: pushFailed },
      email: { sent: emailSent, failed: emailFailed, queued: emailQueued },
      eligibleUsers: eligible,
    });
  } catch (e) {
    console.error("[admin/notifications/send]", e);
    return NextResponse.json(
      { error: "Erro ao enviar notificacoes" },
      { status: 500 },
    );
  }
}
