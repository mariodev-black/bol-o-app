import "server-only";

import { getPool } from "@/lib/db";
import {
  BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL,
  BRASIL_MARROCOS_PLACAR_MATCH_ID,
  getBrasilMarrocosPlacarPromoClosesAtMs,
  isBrasilMarrocosPlacarPromoEnabled,
  isBrasilMarrocosPlacarPromoSubmissionOpen,
} from "@/lib/promotions/brasil-marrocos-placar-promo";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

/** Placar confirmado — Brasil 2 x 1 Marrocos (06/06/2026). */
const BRASIL_MARROCOS_CONFIRMED_RESULT = { casa: 2, visitante: 1 } as const;

export type BrasilMarrocosPlacarOfficialResultSource =
  | "env"
  | "match_cache"
  | "confirmed";

export type BrasilMarrocosPlacarOfficialResult = {
  casa: number;
  visitante: number;
  configured: boolean;
  source: BrasilMarrocosPlacarOfficialResultSource;
};

function parseOfficialScores(
  rawCasa: string,
  rawVisitante: string,
): { casa: number; visitante: number } | null {
  if (!rawCasa || !rawVisitante) return null;
  const casa = Number(rawCasa);
  const visitante = Number(rawVisitante);
  if (
    !Number.isFinite(casa) ||
    !Number.isFinite(visitante) ||
    casa < 0 ||
    visitante < 0
  ) {
    return null;
  }
  return { casa, visitante };
}

function getBrasilMarrocosPlacarOfficialResultFromEnv(): BrasilMarrocosPlacarOfficialResult | null {
  const parsed = parseOfficialScores(
    env("BRASIL_MARROCOS_PLACAR_RESULT_CASA"),
    env("BRASIL_MARROCOS_PLACAR_RESULT_VISITANTE"),
  );
  if (!parsed) return null;
  return { ...parsed, configured: true, source: "env" };
}

async function getBrasilMarrocosPlacarOfficialResultFromMatchCache(): Promise<BrasilMarrocosPlacarOfficialResult | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    result_casa: number | null;
    result_visitante: number | null;
  }>(
    `SELECT result_casa, result_visitante
     FROM matches_cache
     WHERE match_id = $1
     LIMIT 1`,
    [BRASIL_MARROCOS_PLACAR_MATCH_ID],
  );
  const row = rows[0];
  if (row?.result_casa == null || row?.result_visitante == null) return null;
  const casa = Number(row.result_casa);
  const visitante = Number(row.result_visitante);
  if (
    !Number.isFinite(casa) ||
    !Number.isFinite(visitante) ||
    casa < 0 ||
    visitante < 0
  ) {
    return null;
  }
  return { casa, visitante, configured: true, source: "match_cache" };
}

export async function resolveBrasilMarrocosPlacarOfficialResult(): Promise<BrasilMarrocosPlacarOfficialResult | null> {
  const fromEnv = getBrasilMarrocosPlacarOfficialResultFromEnv();
  if (fromEnv) return fromEnv;

  const fromCache = await getBrasilMarrocosPlacarOfficialResultFromMatchCache();
  if (fromCache) return fromCache;

  return {
    ...BRASIL_MARROCOS_CONFIRMED_RESULT,
    configured: true,
    source: "confirmed",
  };
}

/** @deprecated Prefer `resolveBrasilMarrocosPlacarOfficialResult()`. */
export function getBrasilMarrocosPlacarOfficialResult(): BrasilMarrocosPlacarOfficialResult | null {
  return getBrasilMarrocosPlacarOfficialResultFromEnv();
}

export type AdminBrasilMarrocosPlacarRow = {
  userId: string;
  userName: string | null;
  userEmail: string;
  predCasa: number;
  predVisitante: number;
  submittedAt: string;
  friendsInvited: number;
  friendsGoal: number;
  scoreExactHit: boolean | null;
  shirtPrizeEligible: boolean;
  freeTicketPrizeEligible: boolean;
};

export type AdminBrasilMarrocosPromoDashboard = {
  promoEnabled: boolean;
  submissionOpen: boolean;
  closesAtIso: string | null;
  officialResult: BrasilMarrocosPlacarOfficialResult | null;
  friendsGoal: number;
  stats: {
    submissionsCount: number;
    exactHitsCount: number;
    freeTicketEligibleCount: number;
    shirtEligibleCount: number;
  };
  rows: AdminBrasilMarrocosPlacarRow[];
};

export async function getAdminBrasilMarrocosPromoDashboard(): Promise<AdminBrasilMarrocosPromoDashboard> {
  const pool = getPool();
  const officialResult = await resolveBrasilMarrocosPlacarOfficialResult();
  const friendsGoal = BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL;

  const { rows } = await pool.query<{
    user_id: string;
    user_name: string | null;
    user_email: string;
    pred_casa: number;
    pred_visitante: number;
    created_at: Date | string;
    friends_invited: number;
  }>(
    `SELECT
       s.user_id,
       u.name AS user_name,
       u.email AS user_email,
       s.pred_casa,
       s.pred_visitante,
       s.created_at,
       COALESCE(ref.n, 0)::int AS friends_invited
     FROM brasil_marrocos_placar_promo_submissions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n
       FROM users ru
       WHERE ru.referred_by_user_id = s.user_id
     ) ref ON true
     ORDER BY s.created_at DESC`,
  );

  const mapped: AdminBrasilMarrocosPlacarRow[] = rows.map((row) => {
    const predCasa = Number(row.pred_casa);
    const predVisitante = Number(row.pred_visitante);
    const friendsInvited = Number(row.friends_invited) || 0;
    const scoreExactHit =
      officialResult == null
        ? null
        : predCasa === officialResult.casa &&
          predVisitante === officialResult.visitante;
    const freeTicketPrizeEligible = scoreExactHit === true;
    const shirtPrizeEligible =
      freeTicketPrizeEligible && friendsInvited >= friendsGoal;

    return {
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      predCasa,
      predVisitante,
      submittedAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      friendsInvited,
      friendsGoal,
      scoreExactHit,
      shirtPrizeEligible,
      freeTicketPrizeEligible,
    };
  });

  return {
    promoEnabled: isBrasilMarrocosPlacarPromoEnabled(),
    submissionOpen: isBrasilMarrocosPlacarPromoSubmissionOpen(),
    closesAtIso: (() => {
      const ms = getBrasilMarrocosPlacarPromoClosesAtMs();
      return ms == null ? null : new Date(ms).toISOString();
    })(),
    officialResult,
    friendsGoal,
    stats: {
      submissionsCount: mapped.length,
      exactHitsCount: mapped.filter((r) => r.scoreExactHit === true).length,
      freeTicketEligibleCount: mapped.filter((r) => r.freeTicketPrizeEligible)
        .length,
      shirtEligibleCount: mapped.filter((r) => r.shirtPrizeEligible).length,
    },
    rows: mapped,
  };
}
