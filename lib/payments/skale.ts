import { ticketTypeLabel, type TicketType } from "@/lib/payments/ticket-config";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function skaleBaseUrl(): string {
  return env("SKALE_API_URL") || "https://api.skalepayments.com.br";
}

function skaleApiKey(): string {
  const key = env("SKALE_API_KEY");
  if (!key) throw new Error("SKALE_API_KEY nao configurada");
  return key;
}

export type CreateSkalePixInput = {
  amountCents: number;
  unitPriceCents: number;
  quantity: number;
  ticketType: TicketType;
  externalRef: string;
  postbackUrl: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
};

type SkaleCreateResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  pix?: {
    qrcode?: string;
    end2EndId?: string | null;
  };
  statusCode?: number;
  timestamp?: string;
  [k: string]: unknown;
};

export async function createSkalePixTransaction(input: CreateSkalePixInput): Promise<{
  providerTransactionId: string;
  status: string;
  pixQrcode: string | null;
  pixEnd2EndId: string | null;
  rawResponse: SkaleCreateResponse;
  rawRequest: Record<string, unknown>;
}> {
  const body = {
    amount: input.amountCents,
    paymentMethod: "pix",
    pix: { expiresInDays: 1 },
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      document: {
        number: input.customer.cpf,
        type: "cpf",
      },
    },
    items: [
      {
        title: ticketTypeLabel(input.ticketType),
        unitPrice: input.unitPriceCents,
        quantity: input.quantity,
        tangible: false,
        externalRef: input.externalRef,
      },
    ],
    postbackUrl: input.postbackUrl,
  };

  const response = await fetch(`${skaleBaseUrl()}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": skaleApiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: SkaleCreateResponse;
  try {
    json = (await response.json()) as SkaleCreateResponse;
  } catch {
    throw new Error(`Skale retornou resposta invalida (status ${response.status})`);
  }

  if (!response.ok || !json.id || !json.status) {
    const msg =
      typeof json.message === "string" ? json.message : `Erro ao criar transacao na Skale (${response.status})`;
    throw new Error(msg);
  }

  return {
    providerTransactionId: json.id,
    status: json.status,
    pixQrcode: json.pix?.qrcode ?? null,
    pixEnd2EndId: json.pix?.end2EndId ?? null,
    rawResponse: json,
    rawRequest: body,
  };
}
