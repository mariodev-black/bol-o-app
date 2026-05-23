import { NextResponse } from "next/server";
import {
  isThreeXPayWebhookPaidStatus,
  normalizeGatewayStatus,
} from "@/lib/payments/gateway";
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
  debtorAccount?: { name?: string; document?: string; accountType?: string };
  [k: string]: unknown;
};

function pickLookupId(p: ThreeXPayWebhookPayload): string | null {
  return p.transactionId?.trim() || p.externalId?.trim() || null;
}

function pickPixEnd2EndId(p: ThreeXPayWebhookPayload): string | null {
  return p.e2e_id?.trim() || p.e2eId?.trim() || null;
}

/** Status terminal além de PAID (cancelado, expirado, falhou). */
function isTerminalNonPaidWebhookStatus(transactionStatus: string): boolean {
  const normalized = normalizeGatewayStatus(transactionStatus);
  return normalized === "cancelled" || normalized === "expired" || normalized === "failed";
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
  const transactionStatus = json.transactionStatus?.trim() ?? "";

  if (!lookupId || !transactionStatus) {
    return NextResponse.json(
      { error: "Payload sem transactionId/externalId ou transactionStatus" },
      { status: 400 },
    );
  }

  const isPaid = isThreeXPayWebhookPaidStatus(transactionStatus);
  const isTerminal = isTerminalNonPaidWebhookStatus(transactionStatus);

  console.info("[threexpay/webhook] received", {
    lookupId,
    transactionStatus,
    isPaid,
    transactionType: json.transactionType,
    externalId: json.externalId,
    e2e_id: pickPixEnd2EndId(json),
  });

  if (!isPaid && !isTerminal) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "Aguardando PAID; status atual ignorado para fluxo de pagamento",
      transactionStatus,
    });
  }

  const processed = await updateTransactionStatusByProviderId({
    providerTransactionId: lookupId,
    status: transactionStatus,
    pixEnd2EndId: pickPixEnd2EndId(json),
    rawWebhook: json,
  });

  if (!processed) {
    return NextResponse.json(
      {
        error: "Transacao nao encontrada para processar webhook",
        lookupId,
        transactionStatus,
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
