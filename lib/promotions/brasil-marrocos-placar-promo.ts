/**
 * Promo "Acerte o placar exato — Amistoso Brasil x Marrocos".
 * Estrutura independente da promo Brasil x Panamá.
 */

import { getPool } from "@/lib/db";
import { getAppOrigin } from "@/lib/seo/config";
import { BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL } from "@/lib/promotions/brasil-marrocos-guest-flow";
import {
  isMeaningfulBrasilMarrocosPlacarSubmission,
  type BrasilMarrocosPlacarPromoStatus,
} from "@/lib/promotions/brasil-marrocos-placar-promo-shared";

export { BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL };
export type { BrasilMarrocosPlacarPromoStatus };
export { isMeaningfulBrasilMarrocosPlacarSubmission };

/** Partida alvo da promo — Brasil x Marrocos da Copa 2026 (comp 72, 13/06/2026 19:00). */
export const BRASIL_MARROCOS_PLACAR_MATCH_ID = 27380;

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envBool(name: string, defaultValue = false): boolean {
  const s = env(name).toLowerCase();
  if (!s) return defaultValue;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Palpite fecha 5 min antes do apito. TODO: atualizar para a data/hora do amistoso Brasil x Marrocos. */
const DEFAULT_BRASIL_MARROCOS_PLACAR_CLOSES_AT = "2026-07-06T18:55:00-03:00";

export function isBrasilMarrocosPlacarPromoEnabled(): boolean {
  return envBool("BRASIL_MARROCOS_PLACAR_PROMO_ENABLED", false);
}

function parseClosesAtMs(raw: string): number | null {
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

export function getBrasilMarrocosPlacarPromoClosesAtMs(): number | null {
  const fromEnv = env("BRASIL_MARROCOS_PLACAR_CLOSES_AT");
  if (fromEnv) {
    const ms = parseClosesAtMs(fromEnv);
    if (ms != null) return ms;
  }
  return parseClosesAtMs(DEFAULT_BRASIL_MARROCOS_PLACAR_CLOSES_AT);
}

export function isBrasilMarrocosPlacarPromoSubmissionOpen(
  nowMs = Date.now(),
): boolean {
  if (!isBrasilMarrocosPlacarPromoEnabled()) return false;
  const closesAt = getBrasilMarrocosPlacarPromoClosesAtMs();
  if (closesAt == null) return true;
  return nowMs < closesAt;
}

async function countUserBrasilMarrocosMatchPredictions(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM predictions p
     INNER JOIN tickets t ON t.id::text = p.ticket_id
     WHERE p.user_id = $1::uuid
       AND p.match_id = $2
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)`,
    [userId, BRASIL_MARROCOS_PLACAR_MATCH_ID],
  );
  return Number(rows[0]?.n) || 0;
}

async function findBrasilMarrocosMatchPrediction(userId: string): Promise<{
  predCasa: number;
  predVisitante: number;
} | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    score_casa: number;
    score_visitante: number;
  }>(
    `SELECT p.score_casa, p.score_visitante
     FROM predictions p
     INNER JOIN tickets t ON t.id::text = p.ticket_id
     WHERE p.user_id = $1::uuid
       AND p.match_id = $2
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)
     ORDER BY p.updated_at DESC NULLS LAST, p.submitted_at DESC
     LIMIT 1`,
    [userId, BRASIL_MARROCOS_PLACAR_MATCH_ID],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    predCasa: Number(row.score_casa),
    predVisitante: Number(row.score_visitante),
  };
}

async function countUserReferralSignups(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM users
     WHERE referred_by_user_id = $1::uuid`,
    [userId],
  );
  return Number(rows[0]?.n) || 0;
}

async function findSubmission(userId: string): Promise<{
  predCasa: number;
  predVisitante: number;
  escanteiosBrasil: number;
  validatedAt: Date | null;
} | null> {
  await ensureBrasilMarrocosPlacarPromoTable();
  const pool = getPool();
  const { rows } = await pool.query<{
    pred_casa: number;
    pred_visitante: number;
    escanteios_brasil: number;
    validated_at: Date | null;
  }>(
    `SELECT pred_casa, pred_visitante, escanteios_brasil, validated_at
     FROM brasil_marrocos_placar_promo_submissions
     WHERE user_id = $1::uuid
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    predCasa: Number(row.pred_casa),
    predVisitante: Number(row.pred_visitante),
    escanteiosBrasil: Number(row.escanteios_brasil),
    validatedAt: row.validated_at,
  };
}

async function getUserReferralCode(userId: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query<{ referral_code: string | null }>(
    `SELECT referral_code FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  return String(rows[0]?.referral_code ?? "").trim();
}

function buildSignupLink(referralCode: string): string {
  const origin = getAppOrigin().replace(/\/+$/, "");
  if (!referralCode) return `${origin}/`;
  return `${origin}/?ref=${encodeURIComponent(referralCode)}`;
}

let tableReady: Promise<void> | null = null;

async function ensureBrasilMarrocosPlacarPromoTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brasil_marrocos_placar_promo_submissions (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          pred_casa SMALLINT NOT NULL CHECK (pred_casa >= 0 AND pred_casa <= 99),
          pred_visitante SMALLINT NOT NULL CHECK (pred_visitante >= 0 AND pred_visitante <= 99),
          escanteios_brasil SMALLINT NOT NULL DEFAULT 0 CHECK (escanteios_brasil >= 0 AND escanteios_brasil <= 99),
          validated_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE brasil_marrocos_placar_promo_submissions
          ADD COLUMN IF NOT EXISTS escanteios_brasil SMALLINT NOT NULL DEFAULT 0 CHECK (escanteios_brasil >= 0 AND escanteios_brasil <= 99);
        ALTER TABLE brasil_marrocos_placar_promo_submissions
          ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS brasil_marrocos_placar_promo_submissions_created_at_idx
          ON brasil_marrocos_placar_promo_submissions (created_at DESC);
      `);
    })();
  }
  await tableReady;
}

const EMPTY_STATUS = (): BrasilMarrocosPlacarPromoStatus => ({
  enabled: false,
  showOfferModal: false,
  hasBet: false,
  alreadySubmitted: false,
  promoActivated: false,
  needsQuotaPurchase: false,
  referralCode: "",
  signupLink: buildSignupLink(""),
  friendsInvited: 0,
  friendsGoal: BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL,
  predCasa: null,
  predVisitante: null,
  escanteiosBrasil: null,
});

export async function getBrasilMarrocosPlacarPromoStatusForUser(
  userId: string,
): Promise<BrasilMarrocosPlacarPromoStatus> {
  if (!isBrasilMarrocosPlacarPromoEnabled()) {
    return EMPTY_STATUS();
  }

  const submissionOpen = isBrasilMarrocosPlacarPromoSubmissionOpen();

  const [matchPredictionsCount, submission, matchPrediction, friendsInvited, referralCode] =
    await Promise.all([
      countUserBrasilMarrocosMatchPredictions(userId),
      findSubmission(userId),
      findBrasilMarrocosMatchPrediction(userId),
      countUserReferralSignups(userId),
      getUserReferralCode(userId),
    ]);

  const hasBet = matchPredictionsCount > 0;
  const meaningfulSubmission =
    submission != null &&
    isMeaningfulBrasilMarrocosPlacarSubmission(
      submission.predCasa,
      submission.predVisitante,
    )
      ? submission
      : null;
  const alreadySubmitted = meaningfulSubmission != null;
  const promoActivated = Boolean(meaningfulSubmission?.validatedAt);
  const needsQuotaPurchase = alreadySubmitted && !promoActivated;
  const signupLink = buildSignupLink(referralCode);

  return {
    enabled: true,
    showOfferModal: submissionOpen && !hasBet && !alreadySubmitted,
    hasBet,
    alreadySubmitted,
    promoActivated,
    needsQuotaPurchase,
    referralCode,
    signupLink,
    friendsInvited,
    friendsGoal: BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL,
    predCasa:
      meaningfulSubmission?.predCasa ?? matchPrediction?.predCasa ?? null,
    predVisitante:
      meaningfulSubmission?.predVisitante ??
      matchPrediction?.predVisitante ??
      null,
    escanteiosBrasil: meaningfulSubmission?.escanteiosBrasil ?? null,
  };
}

export type SubmitBrasilMarrocosPlacarResult =
  | { ok: true; status: BrasilMarrocosPlacarPromoStatus }
  | { ok: false; error: string };

export async function submitBrasilMarrocosPlacarPromoForUser(
  userId: string,
  predCasa: number,
  predVisitante: number,
  escanteiosBrasil: number,
): Promise<SubmitBrasilMarrocosPlacarResult> {
  if (!isBrasilMarrocosPlacarPromoSubmissionOpen()) {
    return { ok: false, error: "Palpite encerrado. A partida já começou." };
  }

  if (
    !Number.isFinite(predCasa) ||
    !Number.isFinite(predVisitante) ||
    predCasa < 0 ||
    predVisitante < 0 ||
    predCasa > 99 ||
    predVisitante > 99
  ) {
    return { ok: false, error: "Placar inválido." };
  }

  if (
    !Number.isFinite(escanteiosBrasil) ||
    escanteiosBrasil < 0 ||
    escanteiosBrasil > 99
  ) {
    return { ok: false, error: "Número de escanteios inválido." };
  }

  if (!isMeaningfulBrasilMarrocosPlacarSubmission(predCasa, predVisitante)) {
    return {
      ok: false,
      error: "Informe o placar exato antes de registrar.",
    };
  }

  const existingSubmission = await findSubmission(userId);
  if (
    existingSubmission &&
    isMeaningfulBrasilMarrocosPlacarSubmission(
      existingSubmission.predCasa,
      existingSubmission.predVisitante,
    )
  ) {
    return { ok: false, error: "Você já enviou seu palpite nesta promoção." };
  }

  const matchPredictionsCount = await countUserBrasilMarrocosMatchPredictions(userId);
  if (matchPredictionsCount > 0) {
    return {
      ok: false,
      error: "Você já palpitou neste jogo no bolão.",
    };
  }

  await ensureBrasilMarrocosPlacarPromoTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO brasil_marrocos_placar_promo_submissions (user_id, pred_casa, pred_visitante, escanteios_brasil)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       pred_casa = EXCLUDED.pred_casa,
       pred_visitante = EXCLUDED.pred_visitante,
       escanteios_brasil = EXCLUDED.escanteios_brasil`,
    [userId, predCasa, predVisitante, escanteiosBrasil],
  );

  const saved = await findSubmission(userId);
  if (
    !saved ||
    saved.predCasa !== predCasa ||
    saved.predVisitante !== predVisitante
  ) {
    return { ok: false, error: "Não foi possível confirmar o palpite salvo." };
  }

  const status = await getBrasilMarrocosPlacarPromoStatusForUser(userId);
  return { ok: true, status };
}

/** Marca participação como válida após pagamento aprovado. */
export async function validateBrasilMarrocosPlacarPromoSubmission(
  userId: string,
): Promise<void> {
  await ensureBrasilMarrocosPlacarPromoTable();
  const pool = getPool();
  await pool.query(
    `UPDATE brasil_marrocos_placar_promo_submissions
     SET validated_at = NOW()
     WHERE user_id = $1::uuid AND validated_at IS NULL`,
    [userId],
  );
}
