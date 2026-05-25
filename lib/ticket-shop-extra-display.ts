/**
 * Vitrine `/tickets` — rodada e título exibidos na compra de bolão extra.
 * Alinhado ao brinde (`EXTRA_GIFT_PROMO_ROUNDS`); override: `TICKET_SHOP_EXTRA_ROUNDS`.
 */

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

export type TicketShopExtraPresentation = {
  roundNumber: number;
  roundLabel: string;
  /** Texto após "Bolão " no card (ex.: "do Brasileiro"). */
  headlineName: string;
};

const DEFAULT_PRESENTATION: Readonly<Record<number, TicketShopExtraPresentation>> = {
  7: {
    roundNumber: 6,
    roundLabel: "6ª Rodada",
    headlineName: "Libertadores",
  },
  10: {
    roundNumber: 18,
    roundLabel: "18ª Rodada",
    headlineName: "do Brasileiro",
  },
};

function parsePinnedRoundsFromEnv(): Map<number, number> {
  const map = new Map<number, number>();
  const raw = env("TICKET_SHOP_EXTRA_ROUNDS") || env("EXTRA_GIFT_PROMO_ROUNDS");
  if (!raw) return map;
  for (const part of raw.split(/[,;\s]+/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    const [idStr, roundStr] = chunk.split(/[:=]/);
    const id = Number.parseInt(idStr?.trim() ?? "", 10);
    const rodada = Number.parseInt(roundStr?.trim() ?? "", 10);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(rodada) && rodada > 0) {
      map.set(id, rodada);
    }
  }
  return map;
}

let pinnedRoundsMemo: Map<number, number> | null = null;

function pinnedRoundOverrides(): Map<number, number> {
  if (!pinnedRoundsMemo) {
    pinnedRoundsMemo = parsePinnedRoundsFromEnv();
  }
  return pinnedRoundsMemo;
}

export function getTicketShopExtraPresentation(
  championshipId: number,
): TicketShopExtraPresentation | null {
  const base = DEFAULT_PRESENTATION[championshipId];
  const overrideRodada = pinnedRoundOverrides().get(championshipId);
  if (!base && overrideRodada == null) return null;
  const roundNumber = overrideRodada ?? base?.roundNumber;
  if (roundNumber == null || roundNumber <= 0) return null;
  const headlineName = base?.headlineName ?? `Campeonato ${championshipId}`;
  return {
    roundNumber,
    roundLabel: `${roundNumber}ª Rodada`,
    headlineName,
  };
}

export function getTicketShopExtraRoundNumber(championshipId: number): number | null {
  return getTicketShopExtraPresentation(championshipId)?.roundNumber ?? null;
}

export function applyTicketShopExtraCatalogItem<
  T extends {
    championshipId: number;
    displayName?: string;
    roundNumber?: number;
    roundLabel?: string;
  },
>(item: T): T {
  const pin = getTicketShopExtraPresentation(item.championshipId);
  if (!pin) return item;
  return {
    ...item,
    displayName: pin.headlineName,
    roundNumber: pin.roundNumber,
    roundLabel: pin.roundLabel,
  };
}
