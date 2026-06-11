import { NextResponse } from "next/server";
import { cartwaveWebhookUrl } from "@/lib/payments/cartwave/config";
import { handleCartwaveWebhookPayload } from "@/lib/payments/cartwave/webhook-handler";
import type { CartwaveWebhookPayload } from "@/lib/payments/cartwave/webhook-types";

export const runtime = "nodejs";

function cartwaveWebhookAuthOk(request: Request): boolean {
  const secret = (process.env.CARTWAVE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return true;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const functionsKey = request.headers.get("x-functions-key")?.trim() ?? "";
  const webhookSecret =
    request.headers.get("x-webhook-secret")?.trim() ??
    request.headers.get("webhook-secret")?.trim() ??
    "";

  const candidates = [auth, functionsKey, webhookSecret];
  return candidates.some((v) => v === secret || v === `Bearer ${secret}`);
}

/** Health check / URL para cadastro na Cartwave. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: cartwaveWebhookUrl(),
    hint: "Cadastre type_webhook=CASHOUT (ou PIX_CASHOUT_SUCCESS) na Cartwave apontando para esta URL.",
  });
}

export async function POST(request: Request) {
  if (!cartwaveWebhookAuthOk(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado" }, { status: 401 });
  }

  let payload: CartwaveWebhookPayload;
  try {
    payload = (await request.json()) as CartwaveWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const eventType = typeof payload.type === "string" ? payload.type : "unknown";
  const data = payload.data ?? {};

  console.info("[cartwave/webhook] received", {
    type: eventType,
    transactionId: data.transaction_id,
    status: data.status,
    tag: data.tag,
  });

  try {
    const result = await handleCartwaveWebhookPayload(payload);
    console.info("[cartwave/webhook] handled", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cartwave/webhook] error", err);
    return NextResponse.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }
}
