import { getArtilheirosTicketPriceCents } from "@/lib/artilheiros/config";
import { getExtraBolaoTicketUnitCents, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { normalizeDailyByEditionInput } from "@/lib/boloes/daily-editions";
import {
  getSkaleBolaoUnitCents,
  isSkaleBolaoCompetition,
} from "@/lib/boloes/skale-config";
import {
  getSkaleDailyBolaoCompetitionId,
  getSkaleDailyBolaoUnitCents,
} from "@/lib/boloes/skale-daily-config";
import {
  getWeekendBolaoUnitCents,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";

export type TicketType = "general" | "daily" | "extra" | "artilheiros";

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
    return parsePositiveInt(env("TICKET_PRICE_DAILY_CENTS"), 1000);
  }
  return parsePositiveInt(env("TICKET_PRICE_GENERAL_CENTS"), 3990);
}

/** Preço unitário dos bolões extra (default R$ 10). */
export function getExtraBolaoUnitCents(): number {
  return getExtraBolaoTicketUnitCents();
}

/** Preço unitário por campeonato extra (Skale = R$ 500). */
export function getExtraBolaoUnitCentsForChampionship(championshipId: number): number {
  if (isSkaleBolaoCompetition(championshipId)) return getSkaleBolaoUnitCents();
  if (isWeekendBolaoCompetition(championshipId)) return getWeekendBolaoUnitCents();
  return getExtraBolaoUnitCents();
}

/** Legado: algumas telas ainda leem `extra` como preço único — alinhado ao bolão extra. */
export function getExtraTicketPriceCents(): number {
  return getExtraBolaoUnitCents();
}

export function ticketTypeLabel(
  type: TicketType,
  _extraChampionshipId?: number,
  dailyEditionNumber?: number,
): string {
  if (type === "daily") {
    return dailyEditionNumber != null && dailyEditionNumber > 0
      ? `Bolão Diário #${dailyEditionNumber}`
      : "Ticket Diario";
  }
  if (type === "general") return "Ticket Geral";
  if (type === "artilheiros") return "Bolão dos Artilheiros";
  return "Bolão extra";
}

export function parseTicketType(input: unknown): TicketType | null {
  if (
    input === "general" ||
    input === "daily" ||
    input === "extra" ||
    input === "artilheiros"
  ) {
    return input;
  }
  return null;
}

export function getProgressiveDiscountPercent(quantity: number): number {
  const q = Math.max(0, Math.trunc(quantity));
  if (q >= 4) return 15;
  if (q === 3) return 10;
  if (q === 2) return 5;
  return 0;
}

/** Preço promocional por cota em `/comprar-cotas` (R$ 29,90). */
export function getComprarCotasPromoUnitCents(): number {
  return parsePositiveInt(env("TICKET_COMPRAR_COTAS_PROMO_UNIT_CENTS"), 2990);
}

export function buildComprarCotasPromoTicketLines(quantity: number): PurchaseTicketLine[] {
  const q = Math.max(1, Math.min(3, Math.trunc(quantity)));
  const unit = getComprarCotasPromoUnitCents();
  return Array.from({ length: q }, () => ({
    ticketType: "general" as const,
    unitCents: unit,
  }));
}

export type ComprarCotasBundleOption = {
  id: 1 | 2 | 3;
  qty: number;
  priceCents: number;
  originalCents: number;
  savingsCents: number;
};

/** Totais exibidos no checkout `/comprar-cotas` (lista R$ 39,90/cota → promo R$ 29,90/cota). */
export function getComprarCotasBundleOptions(): ComprarCotasBundleOption[] {
  const listUnit = getTicketPriceCents("general");
  const promoUnit = getComprarCotasPromoUnitCents();
  const discountPerUnit = listUnit - promoUnit;
  return ([1, 2, 3] as const).map((qty, index) => ({
    id: (index + 1) as 1 | 2 | 3,
    qty,
    priceCents: promoUnit * qty,
    originalCents: listUnit * qty,
    savingsCents: discountPerUnit * qty,
  }));
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
  /** Bolão diário: edição da fase de grupos (`tickets.round_number`). */
  dailyEditionNumber?: number;
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

export function buildDailyEditionPurchaseLines(
  dailyByEdition: Record<number, number> | Record<string, number> | undefined,
): PurchaseTicketLine[] {
  const map = normalizeDailyByEditionInput(dailyByEdition);
  const lines: PurchaseTicketLine[] = [];
  const dailyUnit = getTicketPriceCents("daily");
  const editions = Object.keys(map)
    .map((k) => Number.parseInt(k, 10))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  for (const edition of editions) {
    const q = map[edition] ?? 0;
    for (const unitCents of distributeDiscountedTicketAmounts(dailyUnit, q)) {
      lines.push({ ticketType: "daily", unitCents, dailyEditionNumber: edition });
    }
  }
  return lines;
}

/**
 * Monta as linhas de tickets para um carrinho (0–20 geral; diário por edição; extras por quantidade ou mapa).
 * Desconto progressivo: geral e dia por tipo; extras — uma curva só sobre a quantidade total de extras.
 */
export function buildArtilheirosPurchaseLines(quantity: number): PurchaseTicketLine[] {
  const q = Math.max(0, Math.min(20, Math.trunc(quantity)));
  const unit = getArtilheirosTicketPriceCents();
  return distributeDiscountedTicketAmounts(unit, q).map((unitCents) => ({
    ticketType: "artilheiros" as const,
    unitCents,
  }));
}

export function buildSkaleDailyEditionPurchaseLines(
  skaleDailyByEdition: Record<number, number> | Record<string, number> | undefined,
): PurchaseTicketLine[] {
  const map = normalizeDailyByEditionInput(skaleDailyByEdition);
  const lines: PurchaseTicketLine[] = [];
  const unit = getSkaleDailyBolaoUnitCents();
  const compId = getSkaleDailyBolaoCompetitionId();
  const editions = Object.keys(map)
    .map((k) => Number.parseInt(k, 10))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  for (const edition of editions) {
    const q = map[edition] ?? 0;
    for (const unitCents of distributeDiscountedTicketAmounts(unit, q)) {
      lines.push({
        ticketType: "extra",
        unitCents,
        extraChampionshipId: compId,
        dailyEditionNumber: edition,
      });
    }
  }
  return lines;
}

export function buildPurchaseTicketLines(
  generalQty: number,
  dailyByEdition?: Record<number, number> | Record<string, number>,
  extraInput?: PurchaseExtraInput,
  artilheirosQty = 0,
  skaleDailyByEdition?: Record<number, number> | Record<string, number>,
): PurchaseTicketLine[] {
  const g = Math.max(0, Math.min(20, Math.trunc(generalQty)));
  const lines: PurchaseTicketLine[] = [];
  const genUnit = getTicketPriceCents("general");

  for (const unitCents of distributeDiscountedTicketAmounts(genUnit, g)) {
    lines.push({ ticketType: "general", unitCents });
  }

  lines.push(...buildDailyEditionPurchaseLines(dailyByEdition));
  lines.push(...buildSkaleDailyEditionPurchaseLines(skaleDailyByEdition));
  lines.push(...buildArtilheirosPurchaseLines(artilheirosQty));

  const allowedOrdered = parseExtraBolaoChampionshipIds();

  if (extraInput && "extraQuantity" in extraInput) {
    const q = Math.max(0, Math.min(20, Math.trunc(extraInput.extraQuantity)));
    const seq = expandExtraQuantityWithOrder(q, allowedOrdered);
    seq.forEach((cid) => {
      const unitCents = getExtraBolaoUnitCentsForChampionship(cid);
      const amounts = isSkaleBolaoCompetition(cid)
        ? Array.from({ length: 1 }, () => unitCents)
        : distributeDiscountedTicketAmounts(unitCents, 1);
      lines.push({ ticketType: "extra", unitCents: amounts[0]!, extraChampionshipId: cid });
    });
  } else if (extraInput && "extraByChampionship" in extraInput) {
    const allowedExtra = new Set(allowedOrdered);
    const extraMap = normalizeExtraMap(extraInput.extraByChampionship);
    for (const compId of allowedExtra) {
      const raw = extraMap[compId] ?? 0;
      const cq = Math.max(0, Math.min(20, Math.trunc(raw)));
      const unitCents = getExtraBolaoUnitCentsForChampionship(compId);
      const amounts = isSkaleBolaoCompetition(compId)
        ? Array.from({ length: cq }, () => unitCents)
        : distributeDiscountedTicketAmounts(unitCents, cq);
      for (const lineUnit of amounts) {
        lines.push({ ticketType: "extra", unitCents: lineUnit, extraChampionshipId: compId });
      }
    }
  }

  return lines;
}

export function expectedPurchaseAmountCents(
  generalQty: number,
  dailyByEdition?: Record<number, number> | Record<string, number>,
  extraInput?: PurchaseExtraInput,
): number {
  return buildPurchaseTicketLines(generalQty, dailyByEdition, extraInput).reduce((s, l) => s + l.unitCents, 0);
}

export function totalDailyEditionQuantity(
  dailyByEdition?: Record<number, number> | Record<string, number>,
): number {
  const map = normalizeDailyByEditionInput(dailyByEdition);
  return Object.values(map).reduce((s, q) => s + q, 0);
}
