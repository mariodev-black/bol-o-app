/**
 * Brinde "Bolão extra grátis" pós-login.
 *
 * Um conjunto de cotas grátis por rodada — uma por campeonato extra configurado em
 * `BOLOES_EXTRA_CHAMPIONSHIP_IDS` (ex.: Brasileirão 10 + Premier League 69).
 */

import { getPool } from "@/lib/db";
import {
  extraBolaoFallbackDisplayName,
  isBrasileiraoExtraChampionship,
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

/**
 * Campeonatos elegíveis ao brinde.
 * Default: todos os IDs em `BOLOES_EXTRA_CHAMPIONSHIP_IDS`.
 * Override opcional: `EXTRA_GIFT_PROMO_CHAMPIONSHIP_IDS=10,69` (subconjunto).
 */
export function getExtraGiftChampionshipIds(): number[] {
  if (!isExtraGiftPromoEnabled()) return [];
  const configured = parseExtraBolaoChampionshipIds();
  if (configured.length === 0) return [];

  const override = env("EXTRA_GIFT_PROMO_CHAMPIONSHIP_IDS");
  if (override) {
    const wanted = override
      .split(/[,;\s]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const set = new Set(configured);
    return wanted.filter((id) => set.has(id));
  }

  const legacySingle = env("EXTRA_GIFT_PROMO_CHAMPIONSHIP_ID");
  if (legacySingle) {
    const id = Number.parseInt(legacySingle, 10);
    if (Number.isFinite(id) && id > 0 && configured.includes(id)) {
      return [id];
    }
  }

  return configured;
}

/** Rótulo exibido em destaque ("Valendo R$ 10 MIL"). */
export function getExtraGiftPrizeLabel(): string {
  return env("EXTRA_GIFT_PRIZE_LABEL") || "R$ 10 MIL";
}

/** @deprecated Use `leagues[].displayName` no status. Mantido para admin/config. */
export function getExtraGiftDisplayName(): string {
  const ids = getExtraGiftChampionshipIds();
  if (ids.length === 0) return "Bolão extra";
  const names = ids.map((id) => extraBolaoFallbackDisplayName(id));
  return names.join(" + ");
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

export type ExtraGiftLeagueKind = "brasileirao" | "premier_league" | "other";

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
  /** Pelo menos um campeonato com rodada aberta e sem cota resgatada. */
  canClaim: boolean;
  /** Chave estável para localStorage (dismiss por bundle de rodadas). */
  dismissBundleKey: string;
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
  dismissBundleKey: "",
  championshipId: null,
  rodada: null,
  rodadaNome: null,
  championshipName: null,
  alreadyClaimed: false,
  ticketId: null,
  displayName: getExtraGiftDisplayName(),
});

function buildDismissBundleKey(
  leagues: Array<{ championshipId: number; rodada: number }>,
): string {
  return leagues
    .slice()
    .sort((a, b) => a.championshipId - b.championshipId)
    .map((l) => `${l.championshipId}:${l.rodada}`)
    .join("|");
}

export async function getExtraGiftStatusForUser(userId: string): Promise<ExtraGiftStatus> {
  const championshipIds = getExtraGiftChampionshipIds();
  if (!isExtraGiftPromoEnabled() || championshipIds.length === 0) {
    return EMPTY_STATUS();
  }

  const leagues: ExtraGiftLeagueStatus[] = [];
  const dismissParts: Array<{ championshipId: number; rodada: number }> = [];

  for (const championshipId of championshipIds) {
    const resolved = await resolveCurrentExtraRound(championshipId);
    if (!resolved || !Number.isFinite(resolved.rodada)) {
      continue;
    }
    const rodada = resolved.rodada;
    dismissParts.push({ championshipId, rodada });
    const existing = await findExistingGiftTicket(userId, championshipId, rodada);
    leagues.push({
      championshipId,
      displayName: extraBolaoFallbackDisplayName(championshipId),
      leagueKind: extraGiftLeagueKind(championshipId, resolved.championshipNome),
      championshipName: resolved.championshipNome ?? null,
      rodada,
      rodadaNome: resolved.rodadaNome ?? `${rodada}ª Rodada`,
      alreadyClaimed: existing != null,
      ticketId: existing?.id ?? null,
    });
  }

  if (leagues.length === 0) {
    return EMPTY_STATUS();
  }

  const allClaimed = leagues.every((l) => l.alreadyClaimed);
  const canClaim = leagues.some((l) => !l.alreadyClaimed);
  const first = leagues[0]!;

  return {
    enabled: true,
    prizeLabel: getExtraGiftPrizeLabel(),
    leagues,
    allClaimed,
    canClaim,
    dismissBundleKey: buildDismissBundleKey(dismissParts),
    championshipId: first.championshipId,
    rodada: first.rodada,
    rodadaNome: first.rodadaNome,
    championshipName: first.championshipName,
    alreadyClaimed: allClaimed,
    ticketId: first.ticketId,
    displayName: leagues.map((l) => l.displayName).join(" + "),
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

  const tickets: ClaimedExtraGiftTicket[] = [];
  let anyNew = false;

  for (const league of status.leagues) {
    if (league.alreadyClaimed && league.ticketId) {
      tickets.push({
        championshipId: league.championshipId,
        displayName: league.displayName,
        leagueKind: league.leagueKind,
        ticketId: league.ticketId,
        rodada: league.rodada ?? 0,
        alreadyClaimed: true,
      });
      continue;
    }
    if (league.rodada == null) {
      return {
        ok: false,
        error: `Rodada de ${league.displayName} ainda não foi liberada. Tente novamente em instantes.`,
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
    if (!result.alreadyClaimed) anyNew = true;
    tickets.push({
      championshipId: league.championshipId,
      displayName: league.displayName,
      leagueKind: league.leagueKind,
      ticketId: result.ticketId,
      rodada: league.rodada,
      alreadyClaimed: result.alreadyClaimed,
    });
  }

  if (tickets.length === 0) {
    return { ok: false, error: "Não foi possível resgatar o brinde. Tente novamente em instantes." };
  }

  return {
    ok: true,
    tickets,
    allAlreadyClaimed: !anyNew,
  };
}

/** Helpers para UI (ícone por campeonato). */
export function extraGiftLeagueKind(
  championshipId: number,
  title?: string | null,
): "brasileirao" | "premier_league" | "other" {
  if (isBrasileiraoExtraChampionship(championshipId, title)) return "brasileirao";
  if (isPremierLeagueExtraChampionship(championshipId, title)) return "premier_league";
  return "other";
}
