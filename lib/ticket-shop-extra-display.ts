/**
 * Vitrine `/tickets` — rodada e título exibidos na compra de bolão extra.
 * Alinhado ao brinde (`EXTRA_GIFT_PROMO_ROUNDS`); override: `TICKET_SHOP_EXTRA_ROUNDS`.
 */

import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";

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

/** Título da cota extra paga — prioriza `tickets.round_number`, depois vitrine fixa. */
export function extraBolaoTitleForPaidTicket(
  championshipId: number,
  baseName: string,
  ticketRoundNumber: number | null | undefined,
  liveRounds: Readonly<Record<number, { roundLabel: string }>>,
): string {
  const fromTicket =
    ticketRoundNumber != null &&
    Number.isFinite(Number(ticketRoundNumber)) &&
    Number(ticketRoundNumber) > 0
      ? Math.trunc(Number(ticketRoundNumber))
      : null;
  const display = resolveExtraBolaoDisplayName(championshipId, baseName);
  if (fromTicket != null) {
    return `${display} · ${fromTicket}ª Rodada`;
  }
  const pin = getTicketShopExtraPresentation(championshipId);
  if (pin) {
    return `${display} · ${pin.roundLabel}`;
  }
  const live = liveRounds[championshipId]?.roundLabel?.trim();
  return live ? `${display} · ${live}` : display;
}

/**
 * Rodada efetiva da cota paga: sempre `tickets.round_number` quando existir
 * (cada cota mantém sua rodada — ex. 17ª finalizada e 18ª ativa).
 * Só usa pin da vitrine/brinde quando a rodada não foi gravada.
 */
export function formatExtraRoundLabel(roundNumber: number | null | undefined): string | null {
  if (roundNumber == null || !Number.isFinite(Number(roundNumber)) || Number(roundNumber) <= 0) {
    return null;
  }
  return `${Math.trunc(Number(roundNumber))}ª Rodada`;
}

export function effectiveExtraRoundForPaidTicket(input: {
  championshipId: number;
  roundNumberFromDb: number | null | undefined;
  /** Rodada atual do campeonato (API/cache) — corrige avanço automático legado. */
  liveRoundNumber?: number | null;
}): number | null {
  const fromDb =
    input.roundNumberFromDb != null &&
    Number.isFinite(Number(input.roundNumberFromDb)) &&
    Number(input.roundNumberFromDb) > 0
      ? Math.trunc(Number(input.roundNumberFromDb))
      : null;
  const shopPin = getTicketShopExtraRoundNumber(input.championshipId);
  const live =
    input.liveRoundNumber != null &&
    Number.isFinite(Number(input.liveRoundNumber)) &&
    Number(input.liveRoundNumber) > 0
      ? Math.trunc(Number(input.liveRoundNumber))
      : null;

  if (fromDb != null && shopPin != null && live != null && fromDb === live && shopPin < fromDb) {
    return shopPin;
  }

  if (fromDb != null) return fromDb;
  return shopPin;
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
  const hasLiveRound =
    item.roundNumber != null &&
    Number.isFinite(Number(item.roundNumber)) &&
    Number(item.roundNumber) > 0;
  return {
    ...item,
    displayName: pin.headlineName,
    ...(hasLiveRound
      ? {}
      : { roundNumber: pin.roundNumber, roundLabel: pin.roundLabel }),
  };
}
