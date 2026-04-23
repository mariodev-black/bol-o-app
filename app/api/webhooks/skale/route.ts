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
  end2EndId?: string | null;
  pix?: {
    qrcode?: string | null;
    end2EndId?: string | null;
    receiptUrl?: string | null;
    expirationDate?: string | null;
  };
  transaction?: {
    id?: string;
    status?: string;
    external_id?: string;
    end2EndId?: string | null;
    pix?: {
      qrcode?: string | null;
      end2EndId?: string | null;
      receiptUrl?: string | null;
      expirationDate?: string | null;
    };
  };
  [k: string]: unknown;
};

function pickProviderTransactionId(p: SkaleWebhookPayload): string | null {
  const fromCamel = (p.transaction as { externalId?: string } | undefined)?.externalId;
  return p.id ?? p.transaction?.external_id ?? fromCamel ?? p.transaction?.id ?? null;
}

function pickStatus(p: SkaleWebhookPayload): string | null {
  const s = p.status ?? p.transaction?.status ?? null;
  if (!s) return null;
  return String(s).trim().toLowerCase();
}

function pickPixQrcode(p: SkaleWebhookPayload): string | null {
  return p.pix?.qrcode ?? p.transaction?.pix?.qrcode ?? null;
}

function pickPixEnd2EndId(p: SkaleWebhookPayload): string | null {
  return (
    p.pix?.end2EndId ??
    p.transaction?.pix?.end2EndId ??
    p.end2EndId ??
    p.transaction?.end2EndId ??
    null
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

  const providerTransactionId = pickProviderTransactionId(json);
  const status = pickStatus(json);
  if (!providerTransactionId || !status) {
    return NextResponse.json({ error: "Payload sem id/status" }, { status: 400 });
  }

  await updateTransactionStatusByProviderId({
    providerTransactionId,
    status,
    pixQrcode: pickPixQrcode(json),
    pixEnd2EndId: pickPixEnd2EndId(json),
    rawWebhook: json,
  });

  return NextResponse.json({ ok: true });
}
