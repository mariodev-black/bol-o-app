import { NextResponse } from "next/server";
import { updateTransactionStatusByProviderId } from "@/lib/payments/transactions";

export const runtime = "nodejs";

function webhookSecretOk(request: Request): boolean {
  const expected = process.env.SKALE_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const got = request.headers.get("x-webhook-secret")?.trim();
  return got === expected;
}

type SkaleWebhookPayload = {
  id?: string;
  status?: string;
  pix?: {
    qrcode?: string | null;
    end2EndId?: string | null;
  };
  [k: string]: unknown;
};

export async function POST(request: Request) {
  if (!webhookSecretOk(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado" }, { status: 401 });
  }

  let json: SkaleWebhookPayload;
  try {
    json = (await request.json()) as SkaleWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!json.id || !json.status) {
    return NextResponse.json({ error: "Payload sem id/status" }, { status: 400 });
  }

  await updateTransactionStatusByProviderId({
    providerTransactionId: json.id,
    status: json.status,
    pixQrcode: json.pix?.qrcode ?? null,
    pixEnd2EndId: json.pix?.end2EndId ?? null,
    rawWebhook: json,
  });

  return NextResponse.json({ ok: true });
}
