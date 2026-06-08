const SKALE_MIN_AMOUNT_CENTS = 500;
const SKALE_MAX_AMOUNT_CENTS = 60_000;

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function gatewayBaseUrl(): string {
  return env("SKALE_API_URL") || "https://api.skalepayments.com.br";
}

function apiKey(): string {
  const key = env("SKALE_API_KEY");
  if (!key) throw new Error("SKALE_API_KEY nao configurada");
  return key;
}

/** Uso interno — `amountCents` vem de `buildPurchaseTicketLines` no servidor, nunca do cliente. */
export type CreateSkalePixInput = {
  amountCents: number;
  externalId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  itemTitle?: string;
  expiresInDays?: number;
};

type SkalePixResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  message?: string;
  pix?: {
    qrcode?: string;
    end2EndId?: string | null;
  };
  [k: string]: unknown;
};

function formatPhoneForSkale(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}

function pickPixQrcode(json: SkalePixResponse): string | null {
  const qrcode = json.pix?.qrcode?.trim();
  return qrcode || null;
}

function pickProviderTransactionId(json: SkalePixResponse): string | null {
  const id = json.id?.trim();
  return id || null;
}

function pickErrorMessage(json: SkalePixResponse, status: number): string {
  if (typeof json.message === "string" && json.message.trim()) {
    return json.message.trim();
  }
  return `Erro ao criar PIX na Skale Payments (${status})`;
}

export function assertSkaleAmountCents(amountCents: number): void {
  if (!Number.isFinite(amountCents) || amountCents < SKALE_MIN_AMOUNT_CENTS) {
    throw new Error(`Valor minimo para PIX Skale: R$ ${(SKALE_MIN_AMOUNT_CENTS / 100).toFixed(2)}`);
  }
  if (amountCents > SKALE_MAX_AMOUNT_CENTS) {
    throw new Error(
      `Valor maximo permitido por transacao Skale: R$ ${(SKALE_MAX_AMOUNT_CENTS / 100).toFixed(2)}. Reduza a quantidade de cotas.`,
    );
  }
}

export async function createSkalePixTransaction(input: CreateSkalePixInput): Promise<{
  providerTransactionId: string;
  status: string;
  pixQrcode: string | null;
  pixEnd2EndId: string | null;
  rawResponse: SkalePixResponse;
  rawRequest: Record<string, unknown>;
}> {
  assertSkaleAmountCents(input.amountCents);

  const expiresInDays =
    input.expiresInDays && input.expiresInDays > 0
      ? Math.trunc(input.expiresInDays)
      : Math.max(1, Math.trunc(Number(process.env.SKALE_PIX_EXPIRES_IN_DAYS) || 1));

  const body: Record<string, unknown> = {
    amount: input.amountCents,
    paymentMethod: "pix",
    pix: { expiresInDays },
    customer: {
      name: input.customer.name.trim(),
      email: input.customer.email.trim(),
      phone: formatPhoneForSkale(input.customer.phone),
      document: {
        number: input.customer.document.replace(/\D/g, ""),
        type: "cpf",
      },
    },
    items: [
      {
        title: input.itemTitle?.trim() || "Cota Bolao do Milhao",
        unitPrice: input.amountCents,
        quantity: 1,
        tangible: false,
        externalRef: input.externalId,
      },
    ],
    metadata: { externalId: input.externalId },
  };

  const response = await fetch(`${gatewayBaseUrl()}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: SkalePixResponse;
  const text = await response.text();
  try {
    json = text ? (JSON.parse(text) as SkalePixResponse) : {};
  } catch {
    throw new Error(`Skale Payments retornou resposta invalida (status ${response.status})`);
  }

  const providerTransactionId = pickProviderTransactionId(json);
  const pixQrcode = pickPixQrcode(json);

  if (!response.ok || !providerTransactionId) {
    throw new Error(pickErrorMessage(json, response.status));
  }

  if (!pixQrcode) {
    throw new Error("Skale Payments nao retornou codigo PIX (pix.qrcode)");
  }

  return {
    providerTransactionId,
    status: json.status?.trim() || "waiting_payment",
    pixQrcode,
    pixEnd2EndId: json.pix?.end2EndId?.trim() || null,
    rawResponse: json,
    rawRequest: body,
  };
}
