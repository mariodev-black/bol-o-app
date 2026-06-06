import "server-only";

import { getPool } from "@/lib/db";
import {
  AMISTOSOS_FRIENDLIES_SUBTITLE,
  isAmistososFriendliesCompetition,
  isSerieBExtraGiftChampionship,
} from "@/lib/football/amistosos-friendlies";
import {
  extraGiftLeagueKind,
  formatExtraGiftOfferSubtitle,
  getExtraGiftPromoTargets,
  isExtraGiftPromoEnabled,
  resolveExtraGiftLeagueDisplayName,
} from "@/lib/promotions/extra-gift";
import {
  isBrasilEgitoPlacarPromoEnabled,
  isBrasilEgitoPlacarPromoSubmissionOpen,
  BRASIL_EGITO_PLACAR_MATCH_ID,
} from "@/lib/promotions/brasil-egito-placar-promo";
import type {
  PromoHubItem,
  PromoHubLeagueRow,
  PromoHubResponse,
} from "@/lib/promotions/hub-shared";

export type { PromoHubItem, PromoHubItemId, PromoHubResponse } from "@/lib/promotions/hub-shared";

const HUB_CACHE_TTL_MS = 3_000;

type HubCacheEntry = {
  expiresAt: number;
  value: PromoHubResponse;
};

const hubCache = new Map<string, HubCacheEntry>();

function countHighlights(items: PromoHubItem[]): number {
  return items.filter((i) => i.highlight && i.actionable).length;
}

function hubExtraGiftTargets() {
  return getExtraGiftPromoTargets().filter((t) => {
    const kind = extraGiftLeagueKind(t.championshipId, null);
    return kind !== "premier_league" && kind !== "libertadores";
  });
}

function hubExtraGiftRodadaNome(championshipId: number, rodada: number): string {
  if (isAmistososFriendliesCompetition(championshipId)) {
    return AMISTOSOS_FRIENDLIES_SUBTITLE;
  }
  if (isSerieBExtraGiftChampionship(championshipId)) {
    return "12ª rodada · início 05/06";
  }
  return `${rodada}ª rodada`;
}

function buildExtraGiftLeagues(
  targets: readonly { championshipId: number; rodada: number }[],
  claimedKeys: Set<string>,
): PromoHubLeagueRow[] {
  return targets.map((t) => ({
    displayName: resolveExtraGiftLeagueDisplayName(t.championshipId, null),
    rodadaNome: hubExtraGiftRodadaNome(t.championshipId, t.rodada),
    alreadyClaimed: claimedKeys.has(`${t.championshipId}:${t.rodada}`),
  }));
}

type ExtraGiftHubDb = {
  claimedKeys: Set<string>;
};

type EgitoHubDb = {
  hasBet: boolean;
  alreadySubmitted: boolean;
};

async function fetchHubDbSnapshot(
  userId: string,
  opts: {
    extraGift: boolean;
    championshipIds: number[];
    rodadas: number[];
    egito: boolean;
  },
): Promise<{ extra: ExtraGiftHubDb | null; egito: EgitoHubDb | null }> {
  if (!opts.extraGift && !opts.egito) {
    return { extra: null, egito: null };
  }

  const pool = getPool();
  const params: unknown[] = [userId];

  let extraSelect = "NULL::json AS gift_claimed_json";
  if (opts.extraGift && opts.championshipIds.length > 0) {
    params.push(opts.championshipIds, opts.rodadas);
    const chIdx = params.length - 1;
    const rdIdx = params.length;
    extraSelect = `(SELECT COALESCE(
          json_agg(
            json_build_object(
              'championship_id', t.extra_championship_id,
              'rodada', t.round_number
            )
          ),
          '[]'::json
        )
        FROM tickets t
        INNER JOIN unnest($${chIdx}::int[], $${rdIdx}::int[]) AS targets(championship_id, rodada)
          ON t.extra_championship_id = targets.championship_id
         AND t.round_number = targets.rodada
        WHERE t.user_id = $1::uuid
          AND t.ticket_type = 'extra'
          AND COALESCE(t.is_promo_bonus, false) = true
          AND t.status IN ('paid', 'approved')) AS gift_claimed_json`;
  }

  let egitoSelect = "NULL::boolean AS egito_has_bet, NULL::boolean AS egito_submitted";
  if (opts.egito) {
    params.push(BRASIL_EGITO_PLACAR_MATCH_ID);
    const matchIdx = params.length;
    egitoSelect = `(SELECT EXISTS(
          SELECT 1
          FROM predictions p
          INNER JOIN tickets t ON t.id::text = p.ticket_id
          WHERE t.user_id = $1::uuid
            AND p.match_id = $${matchIdx}
            AND t.status IN ('paid', 'approved')
            AND NOT COALESCE(t.is_promo_bonus, false)
        )) AS egito_has_bet,
        (SELECT EXISTS(
          SELECT 1
          FROM brasil_egito_placar_promo_submissions s
          WHERE s.user_id = $1::uuid
        )) AS egito_submitted`;
  }

  const { rows } = await pool.query<{
    gift_claimed_json: Array<{ championship_id: number; rodada: number }> | null;
    egito_has_bet: boolean | null;
    egito_submitted: boolean | null;
  }>(`SELECT ${extraSelect}, ${egitoSelect}`, params);

  const row = rows[0];
  const claimedKeys = new Set<string>();
  const claimedRows = row?.gift_claimed_json;
  if (Array.isArray(claimedRows)) {
    for (const entry of claimedRows) {
      if (entry?.championship_id != null && entry?.rodada != null) {
        claimedKeys.add(`${entry.championship_id}:${entry.rodada}`);
      }
    }
  }

  return {
    extra: opts.extraGift ? { claimedKeys } : null,
    egito: opts.egito
      ? {
          hasBet: row?.egito_has_bet === true,
          alreadySubmitted: row?.egito_submitted === true,
        }
      : null,
  };
}

async function buildPromoHubForUser(userId: string): Promise<PromoHubResponse> {
  const items: PromoHubItem[] = [];

  const extraTargets = isExtraGiftPromoEnabled() ? hubExtraGiftTargets() : [];
  const extraGiftEnabled = extraTargets.length > 0;
  const egitoEnabled =
    isBrasilEgitoPlacarPromoEnabled() && isBrasilEgitoPlacarPromoSubmissionOpen();

  if (!extraGiftEnabled && !egitoEnabled) {
    return { items: [], highlightCount: 0 };
  }

  const championshipIds = extraTargets.map((t) => t.championshipId);
  const rodadas = extraTargets.map((t) => t.rodada);

  const db = await fetchHubDbSnapshot(userId, {
    extraGift: extraGiftEnabled,
    championshipIds,
    rodadas,
    egito: egitoEnabled,
  });

  if (extraGiftEnabled && db.extra) {
    const leagues = buildExtraGiftLeagues(extraTargets, db.extra.claimedKeys);
    const allClaimed = leagues.every((l) => l.alreadyClaimed);
    const canClaim = leagues.some((l) => !l.alreadyClaimed);
    const claimed = allClaimed;

    items.push({
      id: "extra_gift",
      title: "Cotas grátis",
      description: canClaim
        ? formatExtraGiftOfferSubtitle(leagues)
        : "Suas cotas resgatadas:",
      ctaLabel: canClaim
        ? "Resgatar brinde"
        : claimed
          ? "Ver cotas resgatadas"
          : "Abrir promoção",
      state: canClaim ? "active" : claimed ? "done" : "unavailable",
      category: "brindes",
      tag: "BOLÃO EXTRA",
      leagues,
      actionable: canClaim || claimed,
      highlight: canClaim,
    });
  }

  if (egitoEnabled && db.egito) {
    const pendingOffer = !db.egito.hasBet && !db.egito.alreadySubmitted;
    const submitted = db.egito.alreadySubmitted;
    const blockedByMainBolao = db.egito.hasBet && !db.egito.alreadySubmitted;
    const leagues: PromoHubLeagueRow[] = [
      {
        displayName: "Brasil x Egito",
        rodadaNome: "Amistoso · 06/06 · 19:00",
        alreadyClaimed: submitted,
        unavailable: blockedByMainBolao,
      },
    ];

    items.push({
      id: "brasil_egito_placar",
      title: "Placar exato — Brasil x Egito",
      description: pendingOffer
        ? "Acerte o placar e ganhe cota grátis + chance de camisa oficial."
        : submitted
          ? "Palpite registrado. Convide amigos para liberar a camisa."
          : "Exclusiva para quem ainda não palpitou neste jogo no bolão.",
      ctaLabel: pendingOffer
        ? "Fazer palpite"
        : submitted
          ? "Ver indicações"
          : "Ver promoção",
      state: pendingOffer ? "active" : submitted ? "done" : "unavailable",
      category: "palpite",
      tag: "AMISTOSO",
      leagues,
      actionable: pendingOffer || submitted || blockedByMainBolao,
      highlight: pendingOffer,
    });
  }

  return {
    items,
    highlightCount: countHighlights(items),
  };
}

/** Invalida cache do hub (ex.: após resgate de promo). */
export function invalidatePromoHubCache(userId?: string): void {
  if (userId) {
    hubCache.delete(userId);
    return;
  }
  hubCache.clear();
}

export async function getPromoHubForUser(userId: string): Promise<PromoHubResponse> {
  const now = Date.now();
  const cached = hubCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await buildPromoHubForUser(userId);
  hubCache.set(userId, { expiresAt: now + HUB_CACHE_TTL_MS, value });
  return value;
}
