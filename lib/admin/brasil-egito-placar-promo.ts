import "server-only";

import { getPool } from "@/lib/db";
import {
  BRASIL_EGITO_PLACAR_FRIENDS_GOAL,
  getBrasilEgitoPlacarPromoClosesAtMs,
  isBrasilEgitoPlacarPromoEnabled,
  isBrasilEgitoPlacarPromoSubmissionOpen,
} from "@/lib/promotions/brasil-egito-placar-promo";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

export type BrasilEgitoPlacarOfficialResult = {
  casa: number;
  visitante: number;
  configured: boolean;
};

export function getBrasilEgitoPlacarOfficialResult(): BrasilEgitoPlacarOfficialResult | null {
  const rawCasa = env("BRASIL_EGITO_PLACAR_RESULT_CASA");
  const rawVisitante = env("BRASIL_EGITO_PLACAR_RESULT_VISITANTE");
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
  return { casa, visitante, configured: true };
}

export type AdminBrasilEgitoPlacarRow = {
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

export type AdminBrasilEgitoPromoDashboard = {
  promoEnabled: boolean;
  submissionOpen: boolean;
  closesAtIso: string | null;
  officialResult: BrasilEgitoPlacarOfficialResult | null;
  friendsGoal: number;
  stats: {
    submissionsCount: number;
    exactHitsCount: number;
    shirtEligibleCount: number;
  };
  rows: AdminBrasilEgitoPlacarRow[];
};

export async function getAdminBrasilEgitoPromoDashboard(): Promise<AdminBrasilEgitoPromoDashboard> {
  const pool = getPool();
  const officialResult = getBrasilEgitoPlacarOfficialResult();
  const friendsGoal = BRASIL_EGITO_PLACAR_FRIENDS_GOAL;

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
     FROM brasil_egito_placar_promo_submissions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS n
       FROM users ru
       WHERE ru.referred_by_user_id = s.user_id
     ) ref ON true
     ORDER BY s.created_at DESC`,
  );

  const mapped: AdminBrasilEgitoPlacarRow[] = rows.map((row) => {
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
    promoEnabled: isBrasilEgitoPlacarPromoEnabled(),
    submissionOpen: isBrasilEgitoPlacarPromoSubmissionOpen(),
    closesAtIso: (() => {
      const ms = getBrasilEgitoPlacarPromoClosesAtMs();
      return ms == null ? null : new Date(ms).toISOString();
    })(),
    officialResult,
    friendsGoal,
    stats: {
      submissionsCount: mapped.length,
      exactHitsCount: mapped.filter((r) => r.scoreExactHit === true).length,
      shirtEligibleCount: mapped.filter((r) => r.shirtPrizeEligible).length,
    },
    rows: mapped,
  };
}
