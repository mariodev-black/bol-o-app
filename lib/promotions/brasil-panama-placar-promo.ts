/**
 * Promo "Acerte o placar exato — Amistoso Brasil x Panamá".
 * Estrutura independente da promo Champions League.
 */

import { getPool } from "@/lib/db";
import { getAppOrigin } from "@/lib/seo/config";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envBool(name: string, defaultValue = false): boolean {
  const s = env(name).toLowerCase();
  if (!s) return defaultValue;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export const BRASIL_PANAMA_PLACAR_FRIENDS_GOAL = 3;

/** Maracanã — palpite fecha no apito (21:30 UTC / 18:30 BRT). */
const DEFAULT_BRASIL_PANAMA_PLACAR_CLOSES_AT = "2026-05-31T18:30:00-03:00";

export function isBrasilPanamaPlacarPromoEnabled(): boolean {
  return envBool("BRASIL_PANAMA_PLACAR_PROMO_ENABLED", false);
}

function parseClosesAtMs(raw: string): number | null {
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

export function getBrasilPanamaPlacarPromoClosesAtMs(): number | null {
  const fromEnv = env("BRASIL_PANAMA_PLACAR_CLOSES_AT");
  if (fromEnv) {
    const ms = parseClosesAtMs(fromEnv);
    if (ms != null) return ms;
  }
  return parseClosesAtMs(DEFAULT_BRASIL_PANAMA_PLACAR_CLOSES_AT);
}

export function isBrasilPanamaPlacarPromoSubmissionOpen(
  nowMs = Date.now(),
): boolean {
  if (!isBrasilPanamaPlacarPromoEnabled()) return false;
  const closesAt = getBrasilPanamaPlacarPromoClosesAtMs();
  if (closesAt == null) return true;
  return nowMs < closesAt;
}

export type BrasilPanamaPlacarPromoStatus = {
  enabled: boolean;
  showOfferModal: boolean;
  hasBet: boolean;
  alreadySubmitted: boolean;
  referralCode: string;
  signupLink: string;
  friendsInvited: number;
  friendsGoal: number;
  predCasa: number | null;
  predVisitante: number | null;
};

async function countUserBolaoPredictions(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM predictions p
     INNER JOIN tickets t ON t.id::text = p.ticket_id
     WHERE t.user_id = $1::uuid
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)`,
    [userId],
  );
  return Number(rows[0]?.n) || 0;
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
} | null> {
  await ensureBrasilPanamaPlacarPromoTable();
  const pool = getPool();
  const { rows } = await pool.query<{ pred_casa: number; pred_visitante: number }>(
    `SELECT pred_casa, pred_visitante
     FROM brasil_panama_placar_promo_submissions
     WHERE user_id = $1::uuid
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    predCasa: Number(row.pred_casa),
    predVisitante: Number(row.pred_visitante),
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

async function ensureBrasilPanamaPlacarPromoTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brasil_panama_placar_promo_submissions (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          pred_casa SMALLINT NOT NULL CHECK (pred_casa >= 0 AND pred_casa <= 99),
          pred_visitante SMALLINT NOT NULL CHECK (pred_visitante >= 0 AND pred_visitante <= 99),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS brasil_panama_placar_promo_submissions_created_at_idx
          ON brasil_panama_placar_promo_submissions (created_at DESC);
      `);
    })();
  }
  await tableReady;
}

const EMPTY_STATUS = (): BrasilPanamaPlacarPromoStatus => ({
  enabled: false,
  showOfferModal: false,
  hasBet: false,
  alreadySubmitted: false,
  referralCode: "",
  signupLink: buildSignupLink(""),
  friendsInvited: 0,
  friendsGoal: BRASIL_PANAMA_PLACAR_FRIENDS_GOAL,
  predCasa: null,
  predVisitante: null,
});

export async function getBrasilPanamaPlacarPromoStatusForUser(
  userId: string,
): Promise<BrasilPanamaPlacarPromoStatus> {
  if (!isBrasilPanamaPlacarPromoSubmissionOpen()) {
    return EMPTY_STATUS();
  }

  const [predictionsCount, submission, friendsInvited, referralCode] = await Promise.all([
    countUserBolaoPredictions(userId),
    findSubmission(userId),
    countUserReferralSignups(userId),
    getUserReferralCode(userId),
  ]);

  const hasBet = predictionsCount > 0;
  const alreadySubmitted = submission != null;
  const signupLink = buildSignupLink(referralCode);

  return {
    enabled: true,
    showOfferModal: !hasBet && !alreadySubmitted,
    hasBet,
    alreadySubmitted,
    referralCode,
    signupLink,
    friendsInvited,
    friendsGoal: BRASIL_PANAMA_PLACAR_FRIENDS_GOAL,
    predCasa: submission?.predCasa ?? null,
    predVisitante: submission?.predVisitante ?? null,
  };
}

export type SubmitBrasilPanamaPlacarResult =
  | { ok: true; status: BrasilPanamaPlacarPromoStatus }
  | { ok: false; error: string };

export async function submitBrasilPanamaPlacarPromoForUser(
  userId: string,
  predCasa: number,
  predVisitante: number,
): Promise<SubmitBrasilPanamaPlacarResult> {
  if (!isBrasilPanamaPlacarPromoSubmissionOpen()) {
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

  const predictionsCount = await countUserBolaoPredictions(userId);
  if (predictionsCount > 0) {
    return { ok: false, error: "Você já enviou palpites no bolão." };
  }

  const existing = await findSubmission(userId);
  if (existing) {
    const status = await getBrasilPanamaPlacarPromoStatusForUser(userId);
    return { ok: true, status };
  }

  await ensureBrasilPanamaPlacarPromoTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO brasil_panama_placar_promo_submissions (user_id, pred_casa, pred_visitante)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, predCasa, predVisitante],
  );

  const status = await getBrasilPanamaPlacarPromoStatusForUser(userId);
  return { ok: true, status };
}
