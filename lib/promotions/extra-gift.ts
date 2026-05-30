/**
 * Brinde "Bolão extra grátis" pós-login.
 *
 * Cotas fixas por campeonato/rodada (default: Brasileirão 18ª).
 * Configure com `EXTRA_GIFT_PROMO_CHAMPIONSHIP_IDS` e `EXTRA_GIFT_PROMO_ROUNDS`.
 */

import { getPool } from "@/lib/db";
import { getExtraBolaoFirstPlaceLine } from "@/lib/boloes-prize-copy";
import {
  extraBolaoFallbackDisplayName,
  resolveExtraBolaoDisplayName,
  isBrasileiraoExtraChampionship,
  isLibertadoresExtraChampionship,
  isPremierLeagueExtraChampionship,
} from "@/lib/boloes-extra-competition-branding";
import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { resolveCurrentExtraRound } from "@/lib/football/extras-rodada";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envBool(name: string): boolean {
  const s = env(name).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Liga o modal pós-login + endpoint de claim. */
export function isExtraGiftPromoEnabled(): boolean {
  return envBool("EXTRA_GIFT_PROMO_ENABLED");
}

/** Default do modal: só Brasileirão (sem Libertadores nem Premier). */
const DEFAULT_EXTRA_GIFT_CHAMPIONSHIP_IDS: readonly number[] = [10];

/** Rodadas fixas do brinde quando `EXTRA_GIFT_PROMO_ROUNDS` não define o id. */
const DEFAULT_EXTRA_GIFT_ROUND_BY_CHAMPIONSHIP: Readonly<Record<number, number>> = {
  10: 18,
};

export type ExtraGiftPromoTarget = {
  championshipId: number;
  rodada: number;
};

function parseExtraGiftPromoRoundsMap(): Map<number, number> {
  const map = new Map<number, number>(
    Object.entries(DEFAULT_EXTRA_GIFT_ROUND_BY_CHAMPIONSHIP).map(([k, v]) => [
      Number(k),
      v,
    ]),
  );
  const raw = env("EXTRA_GIFT_PROMO_ROUNDS");
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

/** Libertadores e Premier não entram no brinde pós-cadastro. */
function isExcludedFromExtraGiftPromo(
  championshipId: number,
  title?: string | null,
): boolean {
  if (isPremierLeagueExtraChampionship(championshipId, title)) return true;
  if (isLibertadoresExtraChampionship(championshipId, title)) return true;
  return false;
}

function filterExtraGiftPromoIds(ids: readonly number[]): number[] {
  return ids.filter((id) => !isExcludedFromExtraGiftPromo(id, null));
}

/**
 * Campeonatos + rodada fixa do brinde (não usa rodada “ao vivo” da API).
 * Default: `10` (Brasileirão 18ª) — sem Libertadores nem Premier.
 */
export function getExtraGiftPromoTargets(): ExtraGiftPromoTarget[] {
  if (!isExtraGiftPromoEnabled()) return [];
  const configured = parseExtraBolaoChampionshipIds();
  if (configured.length === 0) return [];

  const configuredSet = new Set(configured);
  const roundsMap = parseExtraGiftPromoRoundsMap();

  let ids: number[];
  const override = env("EXTRA_GIFT_PROMO_CHAMPIONSHIP_IDS");
  if (override) {
    ids = override
      .split(/[,;\s]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && configuredSet.has(n));
  } else {
    const legacySingle = env("EXTRA_GIFT_PROMO_CHAMPIONSHIP_ID");
    if (legacySingle) {
      const id = Number.parseInt(legacySingle, 10);
      ids =
        Number.isFinite(id) && id > 0 && configuredSet.has(id) ? [id] : [];
    } else {
      ids = DEFAULT_EXTRA_GIFT_CHAMPIONSHIP_IDS.filter((id) => configuredSet.has(id));
    }
  }

  ids = filterExtraGiftPromoIds(ids);

  const out: ExtraGiftPromoTarget[] = [];
  for (const championshipId of ids) {
    const rodada = roundsMap.get(championshipId);
    if (rodada != null && rodada > 0) {
      out.push({ championshipId, rodada });
    }
  }
  return out;
}

export function getExtraGiftChampionshipIds(): number[] {
  return getExtraGiftPromoTargets().map((t) => t.championshipId);
}

/** Rótulo exibido em destaque ("Valendo R$ 10 MIL"). */
export function getExtraGiftPrizeLabel(): string {
  return env("EXTRA_GIFT_PRIZE_LABEL") || "R$ 10 MIL";
}

/** Junta nomes das ligas para admin/config (ex.: "Libertadores e Brasileirão"). */
export function formatExtraGiftLeagueNames(
  leagues: ReadonlyArray<{ displayName: string }>,
): string {
  const names = leagues.map((l) => l.displayName.trim()).filter(Boolean);
  if (names.length === 0) return "Bolão extra";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Cópia do step 1 do modal (ex.: linha de 1º colocado por liga). */
export function formatExtraGiftOfferSubtitle(
  leagues: ReadonlyArray<{ displayName: string; championshipId: number }>,
): string {
  if (leagues.length === 0) return "Bolão extra grátis";
  if (leagues.length === 1) {
    const league = leagues[0]!;
    return getExtraBolaoFirstPlaceLine(league.championshipId, league.displayName);
  }
  return leagues
    .map((l) => getExtraBolaoFirstPlaceLine(l.championshipId, l.displayName))
    .join(" · ");
}

/** @deprecated Use `leagues[].displayName` no status. Mantido para admin/config. */
export function getExtraGiftDisplayName(): string {
  const targets = getExtraGiftPromoTargets();
  if (targets.length === 0) return "Bolão extra";
  const names = targets.map((t) => extraBolaoFallbackDisplayName(t.championshipId));
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return names.join(", ");
}

export type ExtraGiftPromoPublicConfig = {
  enabled: boolean;
  championshipIds: number[];
  /** Ex.: "Brasileirão + Premier League" */
  displayName: string;
  prizeLabel: string;
};

export function getExtraGiftPromoPublicConfig(): ExtraGiftPromoPublicConfig {
  const ids = isExtraGiftPromoEnabled() ? getExtraGiftChampionshipIds() : [];
  return {
    enabled: ids.length > 0,
    championshipIds: ids,
    displayName: getExtraGiftDisplayName(),
    prizeLabel: getExtraGiftPrizeLabel(),
  };
}

export type ExtraGiftLeagueKind = "brasileirao" | "premier_league" | "libertadores" | "other";

export type ExtraGiftLeagueStatus = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  championshipName: string | null;
  rodada: number | null;
  rodadaNome: string | null;
  alreadyClaimed: boolean;
  ticketId: string | null;
};

export type ExtraGiftStatus = {
  enabled: boolean;
  prizeLabel: string;
  leagues: ExtraGiftLeagueStatus[];
  /** Todos os campeonatos do brinde já resgatados na rodada atual. */
  allClaimed: boolean;
  /** Pelo menos um campeonato com cota ainda não resgatada nesta rodada. */
  canClaim: boolean;
  /** Texto do step 1 do modal. */
  offerSubtitle: string;
  /** Exibir modal de oferta (há cotas pendentes). */
  showOfferModal: boolean;
  /** Compat legado — primeiro campeonato / primeiro ticket. */
  championshipId: number | null;
  rodada: number | null;
  rodadaNome: string | null;
  championshipName: string | null;
  alreadyClaimed: boolean;
  ticketId: string | null;
  displayName: string;
};

const EMPTY_STATUS = (): ExtraGiftStatus => ({
  enabled: false,
  prizeLabel: getExtraGiftPrizeLabel(),
  leagues: [],
  allClaimed: false,
  canClaim: false,
  offerSubtitle: "",
  showOfferModal: false,
  championshipId: null,
  rodada: null,
  rodadaNome: null,
  championshipName: null,
  alreadyClaimed: false,
  ticketId: null,
  displayName: getExtraGiftDisplayName(),
});

export async function getExtraGiftStatusForUser(userId: string): Promise<ExtraGiftStatus> {
  const targets = getExtraGiftPromoTargets();
  if (!isExtraGiftPromoEnabled() || targets.length === 0) {
    return EMPTY_STATUS();
  }

  const leagues: ExtraGiftLeagueStatus[] = [];

  for (const { championshipId, rodada } of targets) {
    const resolved = await resolveCurrentExtraRound(championshipId).catch(() => null);
    const championshipName = resolved?.championshipNome ?? null;
    const existing = await findExistingGiftTicket(userId, championshipId, rodada);
    leagues.push({
      championshipId,
      displayName: resolveExtraBolaoDisplayName(championshipId, championshipName),
      leagueKind: extraGiftLeagueKind(championshipId, championshipName),
      championshipName,
      rodada,
      rodadaNome: `${rodada}ª Rodada`,
      alreadyClaimed: existing != null,
      ticketId: existing?.id ?? null,
    });
  }

  if (leagues.length === 0) {
    return EMPTY_STATUS();
  }

  const promoLeagues = leagues.filter(
    (l) =>
      l.leagueKind !== "premier_league" &&
      l.leagueKind !== "libertadores" &&
      !isExcludedFromExtraGiftPromo(l.championshipId, l.championshipName ?? l.displayName),
  );

  if (promoLeagues.length === 0) {
    return EMPTY_STATUS();
  }

  const prizeLabel = getExtraGiftPrizeLabel();
  const allClaimed = promoLeagues.every((l) => l.alreadyClaimed);
  const canClaim = promoLeagues.some((l) => !l.alreadyClaimed);
  const showOfferModal = canClaim && !allClaimed;
  const first = promoLeagues[0]!;

  return {
    enabled: true,
    prizeLabel,
    leagues: promoLeagues,
    allClaimed,
    canClaim,
    offerSubtitle: formatExtraGiftOfferSubtitle(promoLeagues),
    showOfferModal,
    championshipId: first.championshipId,
    rodada: first.rodada,
    rodadaNome: first.rodadaNome,
    championshipName: first.championshipName,
    alreadyClaimed: allClaimed,
    ticketId: first.ticketId,
    displayName: formatExtraGiftLeagueNames(promoLeagues),
  };
}

type ExistingGiftTicket = { id: string };

async function findExistingGiftTicket(
  userId: string,
  championshipId: number,
  rodada: number,
): Promise<ExistingGiftTicket | null> {
  const pool = getPool();
  const { rows } = await pool.query<ExistingGiftTicket>(
    `SELECT id::text AS id
     FROM tickets
     WHERE user_id = $1
       AND ticket_type = 'extra'
       AND extra_championship_id = $2
       AND round_number = $3
       AND COALESCE(is_promo_bonus, false) = true
       AND status IN ('paid', 'approved')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, championshipId, rodada],
  );
  return rows[0] ?? null;
}

export type ClaimedExtraGiftTicket = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  ticketId: string;
  rodada: number;
  rodadaNome: string;
  alreadyClaimed: boolean;
};

export type ClaimExtraGiftResult =
  | {
      ok: true;
      tickets: ClaimedExtraGiftTicket[];
      /** true se nenhum ticket novo foi criado (todos já existiam). */
      allAlreadyClaimed: boolean;
    }
  | { ok: false; error: string };

async function claimExtraGiftForChampionship(
  userId: string,
  championshipId: number,
  rodada: number,
): Promise<
  | { ok: true; ticketId: string; alreadyClaimed: boolean }
  | { ok: false; error: string }
> {
  const existing = await findExistingGiftTicket(userId, championshipId, rodada);
  if (existing) {
    return { ok: true, ticketId: existing.id, alreadyClaimed: true };
  }

  const pool = getPool();
  const externalRef = `extra_gift:${userId}:${championshipId}:${rodada}`;

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO tickets (
         user_id, ticket_type, extra_championship_id, round_number,
         unit_price_cents, quantity, total_amount_cents,
         is_promo_bonus, status, external_ref
       )
       VALUES ($1, 'extra', $2, $3, 0, 1, 0, true, 'paid', $4)
       ON CONFLICT (user_id, extra_championship_id, round_number)
         WHERE ticket_type = 'extra'
           AND is_promo_bonus = true
           AND status IN ('paid', 'approved')
       DO NOTHING
       RETURNING id::text AS id`,
      [userId, championshipId, rodada, externalRef],
    );
    const ticketId = rows[0]?.id;
    if (ticketId) {
      return { ok: true, ticketId, alreadyClaimed: false };
    }
  } catch (err) {
    console.warn("[extra-gift] insert raised, attempting recovery", {
      userId,
      championshipId,
      rodada,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const again = await findExistingGiftTicket(userId, championshipId, rodada);
  if (again) {
    return { ok: true, ticketId: again.id, alreadyClaimed: true };
  }

  return { ok: false, error: "Não foi possível resgatar o brinde. Tente novamente em instantes." };
}

export async function claimExtraGiftForUser(userId: string): Promise<ClaimExtraGiftResult> {
  if (!isExtraGiftPromoEnabled()) {
    return { ok: false, error: "Brinde indisponível no momento." };
  }

  const status = await getExtraGiftStatusForUser(userId);
  if (!status.enabled || status.leagues.length === 0) {
    return { ok: false, error: "Brinde indisponível no momento." };
  }

  if (status.allClaimed || !status.canClaim) {
    return {
      ok: false,
      error: "Você já resgatou as cotas grátis desta promoção.",
    };
  }

  const tickets: ClaimedExtraGiftTicket[] = [];
  let anyNew = false;

  for (const league of status.leagues) {
    if (league.alreadyClaimed) continue;

    const rodadaNome = league.rodadaNome ?? `${league.rodada ?? 0}ª Rodada`;

    if (league.rodada == null || league.rodada <= 0) {
      return {
        ok: false,
        error: `Rodada de ${league.displayName} ainda não foi liberada. Tente novamente em instantes.`,
      };
    }

    const existing = await findExistingGiftTicket(
      userId,
      league.championshipId,
      league.rodada,
    );
    if (existing) {
      return {
        ok: false,
        error: `Você já resgatou a cota grátis de ${league.displayName} (${rodadaNome}).`,
      };
    }

    const result = await claimExtraGiftForChampionship(
      userId,
      league.championshipId,
      league.rodada,
    );
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (result.alreadyClaimed) {
      return {
        ok: false,
        error: `Você já resgatou a cota grátis de ${league.displayName} (${rodadaNome}).`,
      };
    }

    anyNew = true;
    tickets.push({
      championshipId: league.championshipId,
      displayName: league.displayName,
      leagueKind: league.leagueKind,
      ticketId: result.ticketId,
      rodada: league.rodada,
      rodadaNome,
      alreadyClaimed: false,
    });
  }

  if (!anyNew || tickets.length === 0) {
    return {
      ok: false,
      error: "Você já resgatou as cotas grátis desta promoção.",
    };
  }

  return {
    ok: true,
    tickets,
    allAlreadyClaimed: false,
  };
}

/** Helpers para UI (ícone por campeonato). */
export function extraGiftLeagueKind(
  championshipId: number,
  title?: string | null,
): ExtraGiftLeagueKind {
  if (isBrasileiraoExtraChampionship(championshipId, title)) return "brasileirao";
  if (isPremierLeagueExtraChampionship(championshipId, title)) return "premier_league";
  if (isLibertadoresExtraChampionship(championshipId, title)) return "libertadores";
  return "other";
}
