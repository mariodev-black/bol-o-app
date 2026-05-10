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

export function getProgressiveDiscountPercent(quantity: number): number {
  const q = Math.max(0, Math.trunc(quantity));
  if (q >= 4) return 15;
  if (q === 3) return 10;
  if (q === 2) return 5;
  return 0;
}

export function calculateProgressiveDiscountTotalCents(unitCents: number, quantity: number): number {
  const q = Math.max(0, Math.trunc(quantity));
  if (q <= 0) return 0;
  const subtotal = unitCents * q;
  const discount = getProgressiveDiscountPercent(q);
  return Math.round((subtotal * (100 - discount)) / 100);
}

function distributeDiscountedTicketAmounts(unitCents: number, quantity: number): number[] {
  const q = Math.max(0, Math.trunc(quantity));
  if (q <= 0) return [];
  const total = calculateProgressiveDiscountTotalCents(unitCents, q);
  const base = Math.floor(total / q);
  const remainder = total - base * q;
  return Array.from({ length: q }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Uma linha de ticket no pedido (valor unitário já considera desconto progressivo, quando aplicável). */
export type PurchaseTicketLine = { ticketType: TicketType; unitCents: number };

/**
 * Monta as linhas de tickets para um carrinho (0–20 de cada tipo).
 * Desconto progressivo por tipo: 1 = 0%, 2 = 5%, 3 = 10%, 4+ = 15%.
 */
export function buildPurchaseTicketLines(generalQty: number, dailyQty: number): PurchaseTicketLine[] {
  const g = Math.max(0, Math.min(20, Math.trunc(generalQty)));
  const d = Math.max(0, Math.min(20, Math.trunc(dailyQty)));
  const lines: PurchaseTicketLine[] = [];
  const genUnit = getTicketPriceCents("general");

  for (const unitCents of distributeDiscountedTicketAmounts(genUnit, g)) {
    lines.push({ ticketType: "general", unitCents });
  }

  const dailyUnit = getTicketPriceCents("daily");
  for (const unitCents of distributeDiscountedTicketAmounts(dailyUnit, d)) {
    lines.push({ ticketType: "daily", unitCents });
  }

  return lines;
}

export function expectedPurchaseAmountCents(generalQty: number, dailyQty: number): number {
  return buildPurchaseTicketLines(generalQty, dailyQty).reduce((s, l) => s + l.unitCents, 0);
}
