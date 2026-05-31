/**
 * Promo "Acerte o placar exato — Final Champions League".
 * Exibida para usuários que ainda não enviaram palpite no bolão.
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

export const CHAMPIONS_PLACAR_FRIENDS_GOAL = 3;

/** Final UCL 2026 — PSG x Arsenal; palpite fecha no apito (21:00 CEST / 16:00 BRT). */
const DEFAULT_CHAMPIONS_PLACAR_CLOSES_AT = "2026-05-30T16:00:00-03:00";

export function isChampionsPlacarPromoEnabled(): boolean {
  return envBool("CHAMPIONS_PLACAR_PROMO_ENABLED", false);
}

function parseClosesAtMs(raw: string): number | null {
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

/** Horário limite para novos palpites (início da partida). */
export function getChampionsPlacarPromoClosesAtMs(): number | null {
  const fromEnv = env("CHAMPIONS_PLACAR_PROMO_CLOSES_AT");
  if (fromEnv) {
    const ms = parseClosesAtMs(fromEnv);
    if (ms != null) return ms;
  }
  return parseClosesAtMs(DEFAULT_CHAMPIONS_PLACAR_CLOSES_AT);
}

export function isChampionsPlacarPromoSubmissionOpen(
  nowMs = Date.now(),
): boolean {
  if (!isChampionsPlacarPromoEnabled()) return false;
  const closesAt = getChampionsPlacarPromoClosesAtMs();
  if (closesAt == null) return true;
  return nowMs < closesAt;
}

export type ChampionsPlacarPromoStatus = {
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
  const pool = getPool();
  const { rows } = await pool.query<{ pred_casa: number; pred_visitante: number }>(
    `SELECT pred_casa, pred_visitante
     FROM champions_placar_promo_submissions
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

const EMPTY_STATUS = (): ChampionsPlacarPromoStatus => ({
  enabled: false,
  showOfferModal: false,
  hasBet: false,
  alreadySubmitted: false,
  referralCode: "",
  signupLink: buildSignupLink(""),
  friendsInvited: 0,
  friendsGoal: CHAMPIONS_PLACAR_FRIENDS_GOAL,
  predCasa: null,
  predVisitante: null,
});

export async function getChampionsPlacarPromoStatusForUser(
  userId: string,
): Promise<ChampionsPlacarPromoStatus> {
  if (!isChampionsPlacarPromoSubmissionOpen()) {
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
    friendsGoal: CHAMPIONS_PLACAR_FRIENDS_GOAL,
    predCasa: submission?.predCasa ?? null,
    predVisitante: submission?.predVisitante ?? null,
  };
}

export type SubmitChampionsPlacarResult =
  | { ok: true; status: ChampionsPlacarPromoStatus }
  | { ok: false; error: string };

export async function submitChampionsPlacarPromoForUser(
  userId: string,
  predCasa: number,
  predVisitante: number,
): Promise<SubmitChampionsPlacarResult> {
  if (!isChampionsPlacarPromoSubmissionOpen()) {
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
    const status = await getChampionsPlacarPromoStatusForUser(userId);
    return { ok: true, status };
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO champions_placar_promo_submissions (user_id, pred_casa, pred_visitante)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, predCasa, predVisitante],
  );

  const status = await getChampionsPlacarPromoStatusForUser(userId);
  return { ok: true, status };
}
