/**
 * Brinde "Bolão extra grátis" pós-login.
 *
 * Fluxo:
 *   1. Usuário loga → host (`ExtraGiftPromoHost`) consulta `/api/promotions/extra-gift`.
 *   2. Se a rodada atual do extra está aberta e o usuário ainda NÃO recebeu
 *      a cota dessa rodada, mostra o modal de oferta.
 *   3. POST `/api/promotions/extra-gift` cria um `ticket` extra com
 *      `is_promo_bonus=true`, `unit_price_cents=0`, `status='paid'` e
 *      `round_number = rodadaAtual`. Operação é idempotente — se já houver
 *      cota daquela rodada, retorna o ticket existente.
 *
 * Decisões de produto:
 *   - 1 cota por usuário POR RODADA (cada nova rodada do extra renova o brinde).
 *   - Cotas grátis NÃO contam para ranking nem para distribuição de prêmios
 *     (vide `lib/ranking/leaderboard.ts` e `lib/prizes/processor.ts`, que
 *     filtram `NOT COALESCE(is_promo_bonus, false)`).
 *   - O valor "R$ 10 MIL" exibido no modal vem de `EXTRA_GIFT_PRIZE_LABEL`
 *     (cosmético — não é checado contra prize pool real).
 */

import { getPool } from "@/lib/db";
import {
  extraBolaoFallbackDisplayName,
  isBrasileiraoExtraChampionship,
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

/** ID do campeonato extra usado como brinde (default: primeiro Brasileirão da config). */
export function getExtraGiftChampionshipId(): number | null {
  if (!isExtraGiftPromoEnabled()) return null;
  const extras = parseExtraBolaoChampionshipIds();
  if (extras.length === 0) return null;

  const explicit = env("EXTRA_GIFT_PROMO_CHAMPIONSHIP_ID");
  if (explicit) {
    const id = Number.parseInt(explicit, 10);
    if (Number.isFinite(id) && id > 0 && extras.includes(id)) return id;
  }
  const brasileirao = extras.find((id) => isBrasileiraoExtraChampionship(id, null));
  return brasileirao ?? extras[0] ?? null;
}

/** Rótulo exibido em destaque ("Valendo R$ 10 MIL"). */
export function getExtraGiftPrizeLabel(): string {
  return env("EXTRA_GIFT_PRIZE_LABEL") || "R$ 10 MIL";
}

/** Texto curto do nome do bolão extra usado em titulos / chamadas. */
export function getExtraGiftDisplayName(): string {
  const cid = getExtraGiftChampionshipId();
  const cfg = env("EXTRA_GIFT_PROMO_BONUS_LABEL");
  if (cfg) return cfg;
  return cid != null ? extraBolaoFallbackDisplayName(cid) : "Bolão extra";
}

/** Snapshot público (server → client) — sem dados específicos do usuário. */
export type ExtraGiftPromoPublicConfig = {
  enabled: boolean;
  championshipId: number | null;
  /** Ex.: "Brasileirão" (curto). */
  displayName: string;
  /** Ex.: "R$ 10 MIL" — exibido no card principal do modal. */
  prizeLabel: string;
};

export function getExtraGiftPromoPublicConfig(): ExtraGiftPromoPublicConfig {
  const enabled = isExtraGiftPromoEnabled();
  const championshipId = enabled ? getExtraGiftChampionshipId() : null;
  return {
    enabled: enabled && championshipId != null,
    championshipId,
    displayName: getExtraGiftDisplayName(),
    prizeLabel: getExtraGiftPrizeLabel(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Estado por usuário (consultado pelo endpoint GET)                          */
/* -------------------------------------------------------------------------- */

/**
 * Estado completo do brinde para um usuário específico.
 *
 * - `enabled=false` → tudo `null`: promo desligada, sem campeonato configurado
 *   ou rodada atual indeterminada (provedor / cache).
 * - `alreadyClaimed=true` → existe ticket extra do usuário para essa rodada
 *   (com `is_promo_bonus=true` E `status IN ('paid','approved')`).
 */
export type ExtraGiftStatus = {
  enabled: boolean;
  championshipId: number | null;
  rodada: number | null;
  rodadaNome: string | null;
  championshipName: string | null;
  alreadyClaimed: boolean;
  /** ID do ticket caso já tenha sido resgatado (para o redirect "Fazer palpites"). */
  ticketId: string | null;
  displayName: string;
  prizeLabel: string;
};

const EMPTY_STATUS = (): ExtraGiftStatus => ({
  enabled: false,
  championshipId: null,
  rodada: null,
  rodadaNome: null,
  championshipName: null,
  alreadyClaimed: false,
  ticketId: null,
  displayName: getExtraGiftDisplayName(),
  prizeLabel: getExtraGiftPrizeLabel(),
});

export async function getExtraGiftStatusForUser(userId: string): Promise<ExtraGiftStatus> {
  const championshipId = getExtraGiftChampionshipId();
  if (!isExtraGiftPromoEnabled() || championshipId == null) {
    return EMPTY_STATUS();
  }
  const resolved = await resolveCurrentExtraRound(championshipId);
  if (!resolved || !Number.isFinite(resolved.rodada)) {
    return EMPTY_STATUS();
  }

  const existing = await findExistingGiftTicket(userId, championshipId, resolved.rodada);

  return {
    enabled: true,
    championshipId,
    rodada: resolved.rodada,
    rodadaNome: resolved.rodadaNome ?? `${resolved.rodada}ª Rodada`,
    championshipName: resolved.championshipNome,
    alreadyClaimed: existing != null,
    ticketId: existing?.id ?? null,
    displayName: getExtraGiftDisplayName(),
    prizeLabel: getExtraGiftPrizeLabel(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Claim — idempotente com proteção em camadas                                */
/*                                                                              */
/*  Três barreiras de proteção contra "duplo brinde na mesma rodada":          */
/*    1. UI: ExtraGiftPromoHost desabilita o botão enquanto `claiming=true`.   */
/*    2. App: SELECT pré-INSERT (caminho rápido / sem stack trace em log).     */
/*    3. DB: índice único parcial `tickets_extra_gift_unique` + ON CONFLICT    */
/*       DO NOTHING — única defesa real contra corrida cross-instance.         */
/*                                                                              */
/*  A migration que cria o índice é                                             */
/*    scripts/sql/20260521-tickets-extra-gift-unique.sql                        */
/* -------------------------------------------------------------------------- */

type ExistingGiftTicket = { id: string };

/**
 * Recupera o ticket de brinde ATIVO (paid/approved) do usuário para uma rodada
 * específica. É a fonte da verdade do `alreadyClaimed` exposto ao client.
 *
 * O predicado bate exatamente com o índice único parcial criado pela migration
 * `20260521-tickets-extra-gift-unique.sql` — mantenha os dois em sincronia.
 */
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

export type ClaimExtraGiftResult =
  | {
      ok: true;
      ticketId: string;
      championshipId: number;
      rodada: number;
      /** `true` se o ticket já existia antes desta chamada (não houve insert). */
      alreadyClaimed: boolean;
    }
  | { ok: false; error: string };

/**
 * Cria (ou recupera) o ticket grátis da rodada atual para o usuário.
 *
 * Idempotência garantida em três camadas, da mais barata para a mais resistente:
 *   (a) SELECT pré-INSERT — caminho mais comum em re-clicks do mesmo usuário.
 *   (b) `INSERT ... ON CONFLICT DO NOTHING` no índice único parcial
 *       `tickets_extra_gift_unique` — única defesa real contra duas requests
 *       simultâneas vindas de instâncias diferentes do app.
 *   (c) Fallback SELECT pós-INSERT — quando o ON CONFLICT zera RETURNING.
 *
 * Postgres-específico: a cláusula `ON CONFLICT ... WHERE` cita o MESMO predicado
 * do índice parcial para que o planner encontre o índice. Mantenha as duas
 * cópias sincronizadas com a migration `20260521-tickets-extra-gift-unique.sql`.
 */
export async function claimExtraGiftForUser(userId: string): Promise<ClaimExtraGiftResult> {
  if (!isExtraGiftPromoEnabled()) {
    return { ok: false, error: "Brinde indisponível no momento." };
  }
  const championshipId = getExtraGiftChampionshipId();
  if (championshipId == null) {
    return { ok: false, error: "Brinde indisponível no momento." };
  }
  const resolved = await resolveCurrentExtraRound(championshipId);
  if (!resolved || !Number.isFinite(resolved.rodada)) {
    return { ok: false, error: "Rodada atual ainda não foi liberada. Tente novamente em instantes." };
  }
  const rodada = resolved.rodada;

  // ─── (a) Caminho rápido: o brinde já existe e está ativo ───────────────────
  const existing = await findExistingGiftTicket(userId, championshipId, rodada);
  if (existing) {
    return {
      ok: true,
      ticketId: existing.id,
      championshipId,
      rodada,
      alreadyClaimed: true,
    };
  }

  const pool = getPool();
  // `external_ref` determinístico — não é UNIQUE no DB, mas serve para auditar
  // e correlacionar logs do brinde com o ticket no painel admin.
  const externalRef = `extra_gift:${userId}:${championshipId}:${rodada}`;

  // ─── (b) INSERT com proteção via índice único parcial ──────────────────────
  // Status `paid` (não `pending_payment`): brinde é instantâneo, não passa
  // pelo gateway. ON CONFLICT cita o MESMO predicado do índice parcial criado
  // em `scripts/sql/20260521-tickets-extra-gift-unique.sql`.
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
      return { ok: true, ticketId, championshipId, rodada, alreadyClaimed: false };
    }
  } catch (err) {
    // Migration ainda não rodou (índice não existe) OU outro erro de constraint
    // → cai no fallback SELECT abaixo (que também cobre o caso comum de race
    // sem ON CONFLICT). Logamos só uma vez para não poluir.
    console.warn("[extra-gift] insert raised, attempting recovery", {
      userId,
      championshipId,
      rodada,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // ─── (c) Fallback: o ON CONFLICT consumiu silenciosamente (ou erro) ───────
  const again = await findExistingGiftTicket(userId, championshipId, rodada);
  if (again) {
    return {
      ok: true,
      ticketId: again.id,
      championshipId,
      rodada,
      alreadyClaimed: true,
    };
  }

  // Se chegou aqui o INSERT não aconteceu E não há ticket — bug real.
  console.error("[extra-gift] claim failed without recoverable state", {
    userId,
    championshipId,
    rodada,
  });
  return { ok: false, error: "Não foi possível resgatar o brinde. Tente novamente em instantes." };
}
