import { NextResponse } from "next/server";
import { isSkaleWebhookPaidStatus, normalizeGatewayStatus } from "@/lib/payments/gateway";
import { updateTransactionStatusByProviderId } from "@/lib/payments/transactions";

export const runtime = "nodejs";

function webhookSecretOk(request: Request): boolean {
  const expected = process.env.SKALE_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const got =
    request.headers.get("webhook-secret")?.trim() ??
    request.headers.get("x-webhook-secret")?.trim();
  return got === expected;
}

type SkaleWebhookPayload = {
  id?: string;
  status?: string;
  end2EndId?: string | null;
  metadata?: { externalId?: string; [k: string]: unknown };
  pix?: { qrcode?: string; end2EndId?: string | null };
  transaction?: { external_id?: string; end2EndId?: string | null };
  [k: string]: unknown;
};

function pickLookupId(p: SkaleWebhookPayload): string | null {
  return (
    p.id?.trim() ||
    p.metadata?.externalId?.trim() ||
    p.transaction?.external_id?.trim() ||
    null
  );
}

function pickPixEnd2EndId(p: SkaleWebhookPayload): string | null {
  return (
    p.end2EndId?.trim() ||
    p.pix?.end2EndId?.trim() ||
    p.transaction?.end2EndId?.trim() ||
    null
  );
}

function pickPixQrcode(p: SkaleWebhookPayload): string | null {
  return p.pix?.qrcode?.trim() || null;
}

function isTerminalNonPaidWebhookStatus(status: string): boolean {
  const normalized = normalizeGatewayStatus(status);
  return (
    normalized === "cancelled" ||
    normalized === "expired" ||
    normalized === "failed" ||
    normalized === "refunded"
  );
}

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

  const lookupId = pickLookupId(json);
  const status = json.status?.trim() ?? "";

  if (!lookupId || !status) {
    return NextResponse.json(
      { error: "Payload sem id/status ou metadata.externalId" },
      { status: 400 },
    );
  }

  const isPaid = isSkaleWebhookPaidStatus(status);
  const isTerminal = isTerminalNonPaidWebhookStatus(status);

  console.info("[skale/webhook] received", {
    lookupId,
    status,
    isPaid,
    externalId: json.metadata?.externalId,
    end2EndId: pickPixEnd2EndId(json),
  });

  if (!isPaid && !isTerminal) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "Aguardando paid; status atual ignorado para fluxo de pagamento",
      status,
    });
  }

  const processed = await updateTransactionStatusByProviderId({
    providerTransactionId: lookupId,
    status,
    pixQrcode: pickPixQrcode(json),
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
    paid: isPaid,
    transactionId: processed.transactionId,
    status: processed.status,
  });
}
