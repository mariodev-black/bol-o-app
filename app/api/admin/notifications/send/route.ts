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
  const audience = payload.audience === "selected" ? "selected" : "all";
  const buttonLabel = trimField(payload.buttonLabel, 80);
  const buttonUrl = trimField(payload.buttonUrl, 500);
  const pushUrl = trimField(payload.pushUrl || payload.buttonUrl, 500) || "/palpites";

  const validationError = validateAdminDispatchInput({
    channels,
    title,
    preview,
    body: messageBody,
    pushUrl,
    buttonLabel,
    buttonUrl,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

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

    const result = await dispatchAdminBroadcast({
      batchId,
      userIds,
      channels,
      title,
      preview,
      body: messageBody,
      pushUrl,
      emailButton: { label: buttonLabel, url: buttonUrl },
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
