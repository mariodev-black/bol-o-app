import { getExtraBolaoTicketUnitCents, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";

export type TicketType = "general" | "daily" | "extra";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function getTicketPriceCents(type: "general" | "daily"): number {
  if (type === "daily") {
    return parsePositiveInt(env("TICKET_PRICE_DAILY_CENTS"), 2000);
  }
  return parsePositiveInt(env("TICKET_PRICE_GENERAL_CENTS"), 3990);
}

/** Preço unitário dos bolões extra (default R$ 10). */
export function getExtraBolaoUnitCents(): number {
  return getExtraBolaoTicketUnitCents();
}

/** Legado: algumas telas ainda leem `extra` como preço único — alinhado ao bolão extra. */
export function getExtraTicketPriceCents(): number {
  return getExtraBolaoUnitCents();
}

export function ticketTypeLabel(type: TicketType, extraChampionshipId?: number): string {
  if (type === "daily") return "Ticket Diario";
  if (type === "general") return "Ticket Geral";
  return extraChampionshipId != null
    ? `Bolao extra (campeonato ${extraChampionshipId})`
    : "Bolao extra";
}

export function parseTicketType(input: unknown): TicketType | null {
  if (input === "general" || input === "daily" || input === "extra") return input;
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
export type PurchaseTicketLine = {
  ticketType: TicketType;
  unitCents: number;
  extraChampionshipId?: number;
};

/**
 * Monta as linhas de tickets para um carrinho (0–20 de cada tipo / por campeonato extra).
 * Desconto progressivo por tipo (e por bolão extra separado): 1 = 0%, 2 = 5%, 3 = 10%, 4+ = 15%.
 */
export function buildPurchaseTicketLines(
  generalQty: number,
  dailyQty: number,
  extraByChampionship?: Record<number, number>
): PurchaseTicketLine[] {
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

  const extraUnit = getExtraBolaoUnitCents();
  const allowedExtra = new Set(parseExtraBolaoChampionshipIds());
  const extraMap = extraByChampionship ?? {};
  for (const compId of allowedExtra) {
    const raw = extraMap[compId] ?? 0;
    const q = Math.max(0, Math.min(20, Math.trunc(raw)));
    for (const unitCents of distributeDiscountedTicketAmounts(extraUnit, q)) {
      lines.push({ ticketType: "extra", unitCents, extraChampionshipId: compId });
    }
  }

  return lines;
}

export function expectedPurchaseAmountCents(
  generalQty: number,
  dailyQty: number,
  extraByChampionship?: Record<number, number>
): number {
  return buildPurchaseTicketLines(generalQty, dailyQty, extraByChampionship).reduce((s, l) => s + l.unitCents, 0);
}
