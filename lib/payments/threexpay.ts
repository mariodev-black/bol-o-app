import { centsToGatewayAmount } from "@/lib/payments/gateway";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function gatewayBaseUrl(): string {
  return env("THREEXPAY_API_URL") || "https://gateway.3xpay.co";
}

function apiKey(): string {
  const key = env("THREEXPAY_API_KEY");
  if (!key) throw new Error("THREEXPAY_API_KEY nao configurada");
  return key;
}

function apiSecret(): string {
  const secret = env("THREEXPAY_API_SECRET");
  if (!secret) throw new Error("THREEXPAY_API_SECRET nao configurada");
  return secret;
}

export type CreateThreeXPayCashInInput = {
  amountCents: number;
  externalId: string;
  callbackUrl: string;
  debtor: {
    name: string;
    document: string;
  };
  expirationSeconds?: number;
  customMessage?: string;
};

type ThreeXPayCashInResponse = {
  status?: string;
  message?: string;
  payment?: {
    transaction_id?: string;
    payment_code?: string;
    link?: string;
    qrcode?: string;
    qr_code?: string;
  };
  transaction?: {
    id?: string;
    status?: string;
    payment_code?: string;
  };
  [k: string]: unknown;
};

function pickPixCode(json: ThreeXPayCashInResponse): string | null {
  const payment = json.payment;
  const tx = json.transaction;
  const candidates = [
    payment?.payment_code,
    payment?.qrcode,
    payment?.qr_code,
    tx?.payment_code,
    typeof json.payment_code === "string" ? json.payment_code : null,
    typeof json.qrcode === "string" ? json.qrcode : null,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return null;
}

function pickProviderTransactionId(json: ThreeXPayCashInResponse): string | null {
  const payment = json.payment;
  const tx = json.transaction;
  const candidates = [
    payment?.transaction_id,
    tx?.id,
    typeof json.transactionId === "string" ? json.transactionId : null,
    typeof json.transaction_id === "string" ? json.transaction_id : null,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return null;
}

function pickStatus(json: ThreeXPayCashInResponse): string {
  const s = json.status ?? json.transaction?.status;
  return s ? String(s) : "PENDING";
}

export async function createThreeXPayCashIn(input: CreateThreeXPayCashInInput): Promise<{
  providerTransactionId: string;
  status: string;
  pixQrcode: string | null;
  pixEnd2EndId: string | null;
  rawResponse: ThreeXPayCashInResponse;
  rawRequest: Record<string, unknown>;
}> {
  const body: Record<string, unknown> = {
    transaction: {
      amount: centsToGatewayAmount(input.amountCents),
      callback_url: input.callbackUrl,
      external_id: input.externalId,
      debtor: {
        name: input.debtor.name,
        document: input.debtor.document.replace(/\D/g, ""),
      },
    },
  };

  if (input.expirationSeconds && input.expirationSeconds > 0) {
    (body.transaction as Record<string, unknown>).expiration = input.expirationSeconds;
  }
  if (input.customMessage?.trim()) {
    (body.transaction as Record<string, unknown>).custom_message = input.customMessage.trim();
  }

  const response = await fetch(`${gatewayBaseUrl()}/transaction/cash-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey(),
      api_secret: apiSecret(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: ThreeXPayCashInResponse;
  const text = await response.text();
  try {
    json = text ? (JSON.parse(text) as ThreeXPayCashInResponse) : {};
  } catch {
    throw new Error(`3xPay retornou resposta invalida (status ${response.status})`);
  }

  const providerTransactionId = pickProviderTransactionId(json);
  const pixQrcode = pickPixCode(json);

  if (!response.ok || !providerTransactionId) {
    const msg =
      typeof json.message === "string" && json.message.trim()
        ? json.message.trim()
        : `Erro ao criar cash-in na 3xPay (${response.status})`;
    throw new Error(msg);
  }

  if (!pixQrcode) {
    throw new Error("3xPay nao retornou codigo PIX (payment_code)");
  }

  return {
    providerTransactionId,
    status: pickStatus(json),
    pixQrcode,
    pixEnd2EndId: null,
    rawResponse: json,
    rawRequest: body,
  };
}
