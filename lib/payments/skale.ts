import { ticketTypeLabel, type PurchaseTicketLine } from "@/lib/payments/ticket-config";

export type SkaleCartLineItem = {
  title: string;
  unitPrice: number;
  quantity: number;
  externalRef: string;
};

/** Agrupa linhas de tickets iguais (tipo + centavos + bolão extra) para o payload da Skale. */
export function buildSkaleCartLineItems(
  lines: PurchaseTicketLine[],
  externalRefPrefix: string
): SkaleCartLineItem[] {
  const map = new Map<string, SkaleCartLineItem>();
  let skuIdx = 0;
  for (const line of lines) {
    if (line.promoBonus || line.unitCents <= 0) continue;
    const key = `${line.ticketType}:${line.unitCents}:${line.extraChampionshipId ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      map.set(key, {
        title: ticketTypeLabel(line.ticketType, line.extraChampionshipId),
        unitPrice: line.unitCents,
        quantity: 1,
        externalRef: `${externalRefPrefix}_sku_${skuIdx++}`,
      });
    }
  }
  return [...map.values()];
}

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
  items: SkaleCartLineItem[];
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
    items: input.items.map((item) => ({
      title: item.title,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      tangible: false,
      externalRef: item.externalRef,
    })),
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
      typeof (json as { message?: string }).message === "string"
        ? (json as { message: string }).message
        : `Erro ao criar transacao na Skale (${response.status})`;
    throw new Error(msg);
  }

  return {
    providerTransactionId: String(json.id),
    status: String(json.status),
    pixQrcode: json.pix?.qrcode ?? null,
    pixEnd2EndId: json.pix?.end2EndId ?? null,
    rawResponse: json,
    rawRequest: body,
  };
}
