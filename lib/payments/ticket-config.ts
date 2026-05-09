export type TicketType = "general" | "daily";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function getTicketPriceCents(type: TicketType): number {
  if (type === "daily") {
    return parsePositiveInt(env("TICKET_PRICE_DAILY_CENTS"), 2000);
  }
  return parsePositiveInt(env("TICKET_PRICE_GENERAL_CENTS"), 3990);
}

export function getExtraTicketPriceCents(): number {
  return parsePositiveInt(env("TICKET_PRICE_EXTRA_CENTS"), 3990);
}

export function ticketTypeLabel(type: TicketType): string {
  return type === "daily" ? "Ticket Diario" : "Ticket Geral";
}

export function parseTicketType(input: unknown): TicketType | null {
  if (input === "general" || input === "daily") return input;
  return null;
}

/** Uma linha de ticket no pedido (valor unitário já considera promo de 2º geral, quando aplicável). */
export type PurchaseTicketLine = { ticketType: TicketType; unitCents: number };

/**
 * Monta as linhas de tickets para um carrinho (0–20 de cada tipo).
 * Regra do 2º geral: exatamente 2 tickets gerais → 1º preço cheio + 2º preço "extra" (TICKET_PRICE_EXTRA_CENTS).
 */
export function buildPurchaseTicketLines(generalQty: number, dailyQty: number): PurchaseTicketLine[] {
  const g = Math.max(0, Math.min(20, Math.trunc(generalQty)));
  const d = Math.max(0, Math.min(20, Math.trunc(dailyQty)));
  const lines: PurchaseTicketLine[] = [];
  const genUnit = getTicketPriceCents("general");
  const extraUnit = getExtraTicketPriceCents();

  if (g === 1) {
    lines.push({ ticketType: "general", unitCents: genUnit });
  } else if (g === 2) {
    lines.push({ ticketType: "general", unitCents: genUnit });
    lines.push({ ticketType: "general", unitCents: extraUnit });
  } else if (g > 2) {
    for (let i = 0; i < g; i++) {
      lines.push({ ticketType: "general", unitCents: genUnit });
    }
  }

  const dailyUnit = getTicketPriceCents("daily");
  for (let i = 0; i < d; i++) {
    lines.push({ ticketType: "daily", unitCents: dailyUnit });
  }

  return lines;
}

export function expectedPurchaseAmountCents(generalQty: number, dailyQty: number): number {
  return buildPurchaseTicketLines(generalQty, dailyQty).reduce((s, l) => s + l.unitCents, 0);
}
