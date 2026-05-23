import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import {
  countBroadcastEligibleUsers,
  listAllBroadcastUserIds,
  parseAdminBroadcastChannels,
  resolveBroadcastUserIds,
} from "@/lib/notifications/admin-broadcast";
import {
  dispatchAdminBroadcast,
  parseOptionalAdminEmailButton,
  resolveAdminPushPath,
  validateAdminDispatchInput,
} from "@/lib/notifications/admin-dispatch";

export const runtime = "nodejs";

type Body = {
  title?: string;
  preview?: string;
  body?: string;
  audience?: "all" | "selected";
  userIds?: string[];
  channels?: string[];
  /** Legado: app | push | app_push | email | all */
  method?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  /** Se false, e-mail sem botão CTA (só texto). */
  includeEmailButton?: boolean;
  pushUrl?: string;
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

  const channels = parseAdminBroadcastChannels(payload);
  const title = trimField(payload.title, 200);
  const preview = trimField(payload.preview, 500);
  const messageBody = trimField(payload.body, 8000);
  const requestedIds = Array.isArray(payload.userIds)
    ? payload.userIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  /** Com IDs na requisição, sempre modo selecionado (evita enviar para todos por engano). */
  const audience: "all" | "selected" =
    payload.audience === "selected" || requestedIds.length > 0
      ? "selected"
      : "all";

  const buttonLabel = trimField(payload.buttonLabel, 80);
  const buttonUrl = trimField(payload.buttonUrl, 500);
  const includeEmailButton = payload.includeEmailButton === true;
  const pushUrlRaw = trimField(payload.pushUrl, 500);
  const pushUrl = resolveAdminPushPath(pushUrlRaw);

  const validationError = validateAdminDispatchInput({
    channels,
    title,
    preview,
    body: messageBody,
    pushUrl: pushUrlRaw,
    buttonLabel,
    buttonUrl,
    includeEmailButton,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    let userIds: string[] = [];
    if (audience === "all") {
      userIds = await listAllBroadcastUserIds();
    } else {
      if (requestedIds.length === 0) {
        return NextResponse.json(
          { error: "Selecione pelo menos um usuario ou escolha todos" },
          { status: 400 },
        );
      }
      userIds = await resolveBroadcastUserIds(requestedIds);
      if (userIds.length === 0) {
        return NextResponse.json(
          { error: "Nenhum usuario valido na selecao (e-mail obrigatorio)" },
          { status: 400 },
        );
      }
      if (userIds.length !== requestedIds.length) {
        return NextResponse.json(
          {
            error: `${requestedIds.length - userIds.length} usuario(s) da selecao nao sao validos ou nao tem e-mail`,
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

    let emailButton: { label: string; url: string } | null = null;
    if (channels.includes("email")) {
      if (includeEmailButton) {
        const parsed = parseOptionalAdminEmailButton(buttonLabel, buttonUrl);
        if (parsed.error) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        emailButton = parsed.button;
      }
    }

    const result = await dispatchAdminBroadcast({
      batchId,
      userIds,
      channels,
      title,
      preview,
      body: messageBody,
      pushUrl,
      emailButton,
    });

    console.info("[admin/notifications/send]", {
      adminId: auth.admin.id,
      audience,
      eligible,
      ...result,
    });

    return NextResponse.json({
      ok: true,
      batchId: result.batchId,
      channels: result.channels,
      audience,
      requested: result.requested,
      app: result.app,
      push: result.push,
      email: result.email,
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
