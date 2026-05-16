import { getExtraBolaoTicketUnitCents, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  copaBonusExtraQuantityForGeneralTickets,
  getCopaBonusExtraChampionshipId,
} from "@/lib/promotions/copa-bonus-extra";

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

export function ticketTypeLabel(type: TicketType, _extraChampionshipId?: number): string {
  if (type === "daily") return "Ticket Diario";
  if (type === "general") return "Ticket Geral";
  return "Bolão extra";
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
  /** Cota extra grátis (promo Copa → Brasileirão); não entra no PIX. */
  promoBonus?: boolean;
};

/** Compra de extras: uma quantidade total (desconto progressivo sobre o total) ou mapa legado por campeonato. */
export type PurchaseExtraInput =
  | { extraQuantity: number }
  | { extraByChampionship: Record<number, number> };

/**
 * Expande N cotas extras na mesma ordem dos IDs permitidos (round-robin).
 * `allowedOrderedIds` deve seguir a ordem do servidor (ex.: `parseExtraBolaoChampionshipIds()` ou GET `extraBoloes`).
 */
export function expandExtraQuantityWithOrder(quantity: number, allowedOrderedIds: number[]): number[] {
  const q = Math.max(0, Math.min(20, Math.trunc(quantity)));
  if (q <= 0 || allowedOrderedIds.length === 0) return [];
  const seq: number[] = [];
  for (let i = 0; i < q; i++) {
    seq.push(allowedOrderedIds[i % allowedOrderedIds.length]!);
  }
  return seq;
}

/** Contagem por campeonato após round-robin (útil p/ localStorage / exibição). */
export function championshipCountsFromExtraQuantity(
  quantity: number,
  allowedOrderedIds: number[],
): Record<number, number> {
  const seq = expandExtraQuantityWithOrder(quantity, allowedOrderedIds);
  const out: Record<number, number> = {};
  for (const cid of seq) {
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}

function normalizeExtraMap(map: Record<number, number> | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  if (!map) return out;
  const allowedExtra = new Set(parseExtraBolaoChampionshipIds());
  for (const [k, v] of Object.entries(map)) {
    const id = Number.parseInt(k, 10);
    if (!Number.isFinite(id) || !allowedExtra.has(id)) continue;
    out[id] = Math.max(0, Math.min(20, Math.trunc(Number(v) || 0)));
  }
  return out;
}

/**
 * Monta as linhas de tickets para um carrinho (0–20 geral/dia; extras por quantidade total ou mapa legado).
 * Desconto progressivo: geral e dia por tipo; extras — uma curva só sobre a quantidade total de extras.
 */
export function buildPurchaseTicketLines(
  generalQty: number,
  dailyQty: number,
  extraInput?: PurchaseExtraInput,
): PurchaseTicketLine[] {
  const g = Math.max(0, Math.min(20, Math.trunc(generalQty)));
  const d = Math.max(0, Math.min(20, Math.trunc(dailyQty)));
  const lines: PurchaseTicketLine[] = [];
  const genUnit = getTicketPriceCents("general");

  for (const unitCents of distributeDiscountedTicketAmounts(genUnit, g)) {
    lines.push({ ticketType: "general", unitCents });
  }

  const bonusCid = getCopaBonusExtraChampionshipId();
  const bonusQty = copaBonusExtraQuantityForGeneralTickets(g);
  if (bonusCid != null && bonusQty > 0) {
    for (let i = 0; i < bonusQty; i++) {
      lines.push({
        ticketType: "extra",
        unitCents: 0,
        extraChampionshipId: bonusCid,
        promoBonus: true,
      });
    }
  }

  const dailyUnit = getTicketPriceCents("daily");
  for (const unitCents of distributeDiscountedTicketAmounts(dailyUnit, d)) {
    lines.push({ ticketType: "daily", unitCents });
  }

  const extraUnit = getExtraBolaoUnitCents();
  const allowedOrdered = parseExtraBolaoChampionshipIds();

  if (extraInput && "extraQuantity" in extraInput) {
    const q = Math.max(0, Math.min(20, Math.trunc(extraInput.extraQuantity)));
    const seq = expandExtraQuantityWithOrder(q, allowedOrdered);
    const amounts = distributeDiscountedTicketAmounts(extraUnit, seq.length);
    seq.forEach((cid, i) => {
      lines.push({ ticketType: "extra", unitCents: amounts[i]!, extraChampionshipId: cid });
    });
  } else if (extraInput && "extraByChampionship" in extraInput) {
    const allowedExtra = new Set(allowedOrdered);
    const extraMap = normalizeExtraMap(extraInput.extraByChampionship);
    for (const compId of allowedExtra) {
      const raw = extraMap[compId] ?? 0;
      const cq = Math.max(0, Math.min(20, Math.trunc(raw)));
      for (const unitCents of distributeDiscountedTicketAmounts(extraUnit, cq)) {
        lines.push({ ticketType: "extra", unitCents, extraChampionshipId: compId });
      }
    }
  }

  return lines;
}

export function expectedPurchaseAmountCents(
  generalQty: number,
  dailyQty: number,
  extraInput?: PurchaseExtraInput,
): number {
  return buildPurchaseTicketLines(generalQty, dailyQty, extraInput).reduce((s, l) => s + l.unitCents, 0);
}

/** Contagem de extras grátis da promo (por campeonato) já embutidas nas linhas do pedido. */
export function promoBonusExtraCountsFromLines(lines: PurchaseTicketLine[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const line of lines) {
    if (!line.promoBonus || line.ticketType !== "extra") continue;
    const cid = line.extraChampionshipId;
    if (cid == null || !Number.isFinite(cid)) continue;
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}
