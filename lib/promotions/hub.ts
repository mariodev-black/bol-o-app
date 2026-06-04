import "server-only";

import { getPool } from "@/lib/db";
import {
  isBrasilEgitoPlacarPromoEnabled,
  isBrasilEgitoPlacarPromoSubmissionOpen,
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

type EgitoHubDb = {
  hasBet: boolean;
  alreadySubmitted: boolean;
};

async function fetchEgitoHubDb(userId: string): Promise<EgitoHubDb | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    egito_has_bet: boolean | null;
    egito_submitted: boolean | null;
  }>(
    `SELECT
        (SELECT EXISTS(
          SELECT 1
          FROM predictions p
          INNER JOIN tickets t ON t.id::text = p.ticket_id
          WHERE t.user_id = $1::uuid
            AND t.status IN ('paid', 'approved')
            AND NOT COALESCE(t.is_promo_bonus, false)
        )) AS egito_has_bet,
        (SELECT EXISTS(
          SELECT 1
          FROM brasil_egito_placar_promo_submissions s
          WHERE s.user_id = $1::uuid
        )) AS egito_submitted`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;
  return {
    hasBet: row.egito_has_bet === true,
    alreadySubmitted: row.egito_submitted === true,
  };
}

async function buildPromoHubForUser(userId: string): Promise<PromoHubResponse> {
  const items: PromoHubItem[] = [];

  const egitoEnabled =
    isBrasilEgitoPlacarPromoEnabled() && isBrasilEgitoPlacarPromoSubmissionOpen();

  if (!egitoEnabled) {
    return { items: [], highlightCount: 0 };
  }

  const egito = await fetchEgitoHubDb(userId);
  if (!egito) {
    return { items: [], highlightCount: 0 };
  }

  const pendingOffer = !egito.hasBet && !egito.alreadySubmitted;
  const submitted = egito.alreadySubmitted;
  const leagues: PromoHubLeagueRow[] = [
    {
      displayName: "Brasil x Egito",
      rodadaNome: "Amistoso · 06/06 · 19:00",
      alreadyClaimed: submitted,
    },
  ];

  items.push({
    id: "brasil_egito_placar",
    title: "Placar exato — Brasil x Egito",
    description: pendingOffer
      ? "Acerte o placar e ganhe cota grátis + chance de camisa oficial."
      : submitted
        ? "Palpite registrado. Convide amigos para liberar a camisa."
        : "Promoção encerrada para novos palpites.",
    ctaLabel: pendingOffer
      ? "Fazer palpite"
      : submitted
        ? "Ver indicações"
        : "Ver promoção",
    state: pendingOffer ? "active" : submitted ? "done" : "unavailable",
    category: "palpite",
    tag: "AMISTOSO",
    leagues,
    actionable: pendingOffer || submitted,
    highlight: pendingOffer,
  });

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
