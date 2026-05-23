import { NextResponse } from "next/server";
import { normalizeGatewayStatus } from "@/lib/payments/gateway";
import { updateTransactionStatusByProviderId } from "@/lib/payments/transactions";

export const runtime = "nodejs";

function webhookSecretOk(request: Request): boolean {
  const expected = process.env.THREEXPAY_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const got =
    request.headers.get("x-webhook-secret")?.trim() ??
    request.headers.get("x-threexpay-secret")?.trim();
  return got === expected;
}

type ThreeXPayWebhookPayload = {
  transactionId?: string;
  transactionStatus?: string;
  transactionType?: string;
  value?: string;
  externalId?: string;
  e2e_id?: string;
  e2eId?: string;
  [k: string]: unknown;
};

function pickLookupId(p: ThreeXPayWebhookPayload): string | null {
  return (
    p.transactionId?.trim() ||
    p.externalId?.trim() ||
    null
  );
}

function pickStatus(p: ThreeXPayWebhookPayload): string | null {
  const raw = p.transactionStatus?.trim();
  if (!raw) return null;
  return normalizeGatewayStatus(raw);
}

function pickPixEnd2EndId(p: ThreeXPayWebhookPayload): string | null {
  return p.e2e_id?.trim() || p.e2eId?.trim() || null;
}

export async function POST(request: Request) {
  if (!webhookSecretOk(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado" }, { status: 401 });
  }

  let json: ThreeXPayWebhookPayload;
  try {
    json = (await request.json()) as ThreeXPayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const lookupId = pickLookupId(json);
  const status = pickStatus(json);
  if (!lookupId || !status) {
    return NextResponse.json(
      { error: "Payload sem transactionId/externalId ou transactionStatus" },
      { status: 400 },
    );
  }

  console.info("[threexpay/webhook] received", {
    lookupId,
    status,
    transactionType: json.transactionType,
    externalId: json.externalId,
    e2e_id: pickPixEnd2EndId(json),
  });

  const processed = await updateTransactionStatusByProviderId({
    providerTransactionId: lookupId,
    status,
    pixEnd2EndId: pickPixEnd2EndId(json),
    rawWebhook: json,
  });

  if (!processed) {
    return NextResponse.json(
      {
        error: "Transacao nao encontrada para processar webhook",
        lookupId,
        status,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    transactionId: processed.transactionId,
    status: processed.status,
  });
}
