import { NextResponse } from "next/server";
import { fyhubWebhookUrl } from "@/lib/payments/fyhub/config";
import {
  handleFyhubCashoutWebhookPayload,
  type FyhubWebhookPayload,
} from "@/lib/payments/fyhub/webhook-handler";

export const runtime = "nodejs";

function webhookAuthOk(request: Request): boolean {
  const secret = (process.env.FYHUB_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const webhookSecret =
    request.headers.get("x-webhook-secret")?.trim() ??
    request.headers.get("webhook-secret")?.trim() ??
    "";
  return (
    auth === secret ||
    auth === `Bearer ${secret}` ||
    webhookSecret === secret
  );
}

/** Cadastre na Fyhub Contas: webhook type TRANSFER (e CASHOUT se disponível). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "fyhub-accounts",
    webhook: fyhubWebhookUrl(),
    hint: "Cadastre webhook TRANSFER em https://pagamentos.fyhub.com.br apontando para esta URL (cash-out liquidado/cancelado).",
  });
}

export async function POST(request: Request) {
  if (!webhookAuthOk(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado" }, { status: 401 });
  }

  let payload: FyhubWebhookPayload;
  try {
    payload = (await request.json()) as FyhubWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  console.info("[fyhub/webhook] received", {
    type: payload.type,
    status: payload.data?.status,
    id: payload.data?.id,
    endToEndId: payload.data?.endToEndId,
    idempotencyKey: payload.data?.idempotencyKey,
  });

  try {
    const result = await handleFyhubCashoutWebhookPayload(payload);
    console.info("[fyhub/webhook] handled", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[fyhub/webhook] error", err);
    return NextResponse.json({ error: "Erro ao processar webhook Fyhub" }, { status: 500 });
  }
}
