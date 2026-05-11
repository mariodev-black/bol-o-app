import { getPool } from "@/lib/db";

export type AdminAffiliateStats = {
  referredUsersCount: number;
  commissionsCount: number;
  commissionTotalCents: number;
  pendingWithdrawalsCents: number;
  influencersCount: number;
};

export type AdminAffiliateRow = {
  id: string;
  name: string | null;
  email: string;
  referralCode: string | null;
  affiliateMode: "standard" | "influencer";
  influencerCpaBps: number;
  referredUsersCount: number;
  paidReferralsCount: number;
  commissionsCount: number;
  commissionsCents: number;
  createdAt: string;
};

export type AdminReferredUserRow = {
  id: string;
  name: string | null;
  email: string;
  cpf: string | null;
  referrerId: string;
  referrerName: string | null;
  referrerEmail: string;
  paidTicketsCount: number;
  createdAt: string;
};

export type AdminAffiliateCommissionRow = {
  id: string;
  referrerName: string | null;
  referrerEmail: string;
  referredName: string | null;
  referredEmail: string;
  amountCents: number;
  tier: string;
  commissionIndex: number;
  commissionModel: "standard" | "influencer";
  cpaBps: number | null;
  baseAmountCents: number | null;
  createdAt: string;
};

export type AdminAffiliateDashboardData = {
  stats: AdminAffiliateStats;
  affiliates: AdminAffiliateRow[];
  referredUsers: AdminReferredUserRow[];
  commissions: AdminAffiliateCommissionRow[];
};

export type AdminPredictionStats = {
  predictionsCount: number;
  playersCount: number;
  ticketsCount: number;
};

export type AdminPredictionListItem = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  ticketId: string;
  ticketType: string | null;
  bolaoType: string;
  matchId: number;
  homeName: string;
  homeLogo: string | null;
  awayName: string;
  awayLogo: string | null;
  matchDateBR: string | null;
  matchHourBR: string | null;
  matchStatus: string | null;
  scoreCasa: number;
  scoreVisitante: number;
  resultCasa: number | null;
  resultVisitante: number | null;
  points: number;
  submittedAt: string;
  updatedAt: string;
};

export type AdminTransactionStats = {
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  paidAmountCents: number;
};

export type AdminTransactionListItem = {
  id: string;
  providerTransactionId: string | null;
  userId: string;
  userName: string | null;
  userEmail: string;
  ticketId: string | null;
  ticketType: string;
  provider: string;
  paymentMethod: string;
  status: string;
  amountCents: number;
  externalRef: string | null;
  pixEnd2EndId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminTicketListItem = {
  id: string;
  userName: string | null;
  userEmail: string;
  ticketType: string;
  status: string;
  unitPriceCents: number;
  quantity: number;
  totalAmountCents: number;
  externalRef: string | null;
  paidAt: string | null;
  createdAt: string;
  predictionsCount: number;
  pendingPredictionsCount: number;
  totalMatchesCount: number;
  scorePoints: number;
  rankingPosition: number | null;
  lastPredictionAt: string | null;
};

export type AdminTicketPredictionItem = {
  id: string;
  matchId: number;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  dateBR: string | null;
  hourBR: string | null;
  status: string | null;
  scoreCasa: number;
  scoreVisitante: number;
  resultCasa: number | null;
  resultVisitante: number | null;
  points: number;
  submittedAt: string;
  updatedAt: string;
};

export type AdminTicketDetail = AdminTicketListItem & {
  userId: string;
  userCpf: string | null;
  userPhone: string | null;
  transactionId: string | null;
  providerTransactionId: string | null;
  transactionStatus: string | null;
  transactionAmountCents: number | null;
  transactionCreatedAt: string | null;
  predictions: AdminTicketPredictionItem[];
};

export type AdminBolaoRankingRow = {
  position: number;
  ticketId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  ticketType: string;
  groupDate: string | null;
  scorePoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  predictionsCount: number;
  pendingPredictionsCount: number;
  totalMatchesCount: number;
  paidAt: string | null;
  createdAt: string;
};

export type AdminDailyBolaoCard = {
  date: string;
  ticketsCount: number;
  playersCount: number;
  totalPoints: number;
  availableCount: number;
  inUseCount: number;
  finishedCount: number;
  topRows: AdminBolaoRankingRow[];
};

export type AdminBoloesDashboardData = {
  principal: {
    ticketsCount: number;
    playersCount: number;
    totalPoints: number;
    ranking: AdminBolaoRankingRow[];
  };
  dailyCards: AdminDailyBolaoCard[];
  selectedDailyDate: string | null;
  selectedDailyRanking: AdminBolaoRankingRow[];
};

export async function getAdminAffiliateStats(): Promise<AdminAffiliateStats> {
  const pool = getPool();
  const { rows } = await pool.query<{
    referred_users_count: string | number;
    commissions_count: string | number;
    commission_total_cents: string | number | null;
    pending_withdrawals_cents: string | number | null;
    influencers_count: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE referred_by_user_id IS NOT NULL) AS referred_users_count,
       (SELECT COUNT(*) FROM referral_commissions) AS commissions_count,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM referral_commissions) AS commission_total_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM affiliate_withdrawal_requests WHERE status = 'pending') AS pending_withdrawals_cents,
       (SELECT COUNT(*) FROM users WHERE affiliate_mode = 'influencer') AS influencers_count`
  );
  const row = rows[0];
  return {
    referredUsersCount: Number(row?.referred_users_count ?? 0),
    commissionsCount: Number(row?.commissions_count ?? 0),
    commissionTotalCents: Number(row?.commission_total_cents ?? 0),
    pendingWithdrawalsCents: Number(row?.pending_withdrawals_cents ?? 0),
    influencersCount: Number(row?.influencers_count ?? 0),
  };
}

function rankBolaoRows(rows: Omit<AdminBolaoRankingRow, "position">[]): AdminBolaoRankingRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.scorePoints !== a.scorePoints) return b.scorePoints - a.scorePoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
      if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function bolaoUsageStatus(row: Pick<AdminBolaoRankingRow, "predictionsCount" | "pendingPredictionsCount">) {
  if (row.predictionsCount <= 0) return "available";
  if (row.pendingPredictionsCount > 0) return "in_use";
  return "finished";
}

export async function getAdminBoloesDashboardData(selectedDailyDate?: string | null): Promise<AdminBoloesDashboardData> {
  const pool = getPool();
  const { rows } = await pool.query<{
    ticket_id: string;
    user_id: string;
    user_name: string | null;
    user_email: string;
    ticket_type: string;
    group_date: string | null;
    score_points: string | number | null;
    exact_count: string | number | null;
    outcome_count: string | number | null;
    goals_count: string | number | null;
    predictions_count: string | number;
    total_matches_count: string | number;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `WITH prediction_counts AS (
       SELECT ticket_id, COUNT(*) AS predictions_count
       FROM predictions
       GROUP BY ticket_id
     ),
     first_prediction_dates AS (
       SELECT DISTINCT ON (p.ticket_id) p.ticket_id, mc.date_br
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE mc.date_br IS NOT NULL
       ORDER BY p.ticket_id, p.submitted_at ASC
     ),
     ticket_groups AS (
       SELECT
         t.id,
         CASE
           WHEN t.ticket_type = 'daily' THEN COALESCE(fpd.date_br, to_char(COALESCE(t.paid_at, t.created_at), 'DD/MM/YYYY'))
           ELSE 'GERAL'
         END AS group_date
       FROM tickets t
       LEFT JOIN first_prediction_dates fpd ON fpd.ticket_id::text = t.id::text
       WHERE t.status IN ('paid', 'approved')
     ),
     prediction_scores AS (
       SELECT
         p.ticket_id,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 6
             WHEN (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             THEN CASE
               WHEN p.score_casa = mc.result_casa OR p.score_visitante = mc.result_visitante THEN 4
               ELSE 3
             END
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS score_points,
         COUNT(*) FILTER (WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL AND p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante) AS exact_count,
         COUNT(*) FILTER (
           WHERE mc.result_casa IS NOT NULL
             AND mc.result_visitante IS NOT NULL
             AND (
               (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             )
         ) AS outcome_count,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 0
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS goals_count
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       GROUP BY p.ticket_id
     )
     SELECT
       t.id AS ticket_id,
       t.user_id,
       u.name AS user_name,
       u.email AS user_email,
       t.ticket_type,
       tg.group_date,
       COALESCE(ps.score_points, 0) AS score_points,
       COALESCE(ps.exact_count, 0) AS exact_count,
       COALESCE(ps.outcome_count, 0) AS outcome_count,
       COALESCE(ps.goals_count, 0) AS goals_count,
       COALESCE(pc.predictions_count, 0) AS predictions_count,
       CASE
         WHEN t.ticket_type = 'daily' THEN (SELECT COUNT(*) FROM matches_cache mc WHERE mc.date_br = tg.group_date)
         ELSE (SELECT COUNT(*) FROM matches_cache)
       END AS total_matches_count,
       t.paid_at,
       t.created_at
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     JOIN ticket_groups tg ON tg.id::text = t.id::text
     LEFT JOIN prediction_counts pc ON pc.ticket_id::text = t.id::text
     LEFT JOIN prediction_scores ps ON ps.ticket_id::text = t.id::text
     WHERE t.status IN ('paid', 'approved')
     ORDER BY t.created_at DESC`
  );

  const baseRows = rows.map<Omit<AdminBolaoRankingRow, "position">>((row) => {
    const predictionsCount = Number(row.predictions_count ?? 0);
    const totalMatchesCount = Number(row.total_matches_count ?? 0);
    return {
      ticketId: row.ticket_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      ticketType: row.ticket_type,
      groupDate: row.group_date,
      scorePoints: Number(row.score_points ?? 0),
      exactCount: Number(row.exact_count ?? 0),
      outcomeCount: Number(row.outcome_count ?? 0),
      goalsCount: Number(row.goals_count ?? 0),
      predictionsCount,
      pendingPredictionsCount: Math.max(totalMatchesCount - predictionsCount, 0),
      totalMatchesCount,
      paidAt: row.paid_at ? row.paid_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    };
  });

  const principalRanking = rankBolaoRows(baseRows.filter((row) => row.ticketType === "general"));
  const dailyGroups = new Map<string, Omit<AdminBolaoRankingRow, "position">[]>();
  for (const row of baseRows) {
    if (row.ticketType !== "daily" || !row.groupDate) continue;
    const group = dailyGroups.get(row.groupDate) ?? [];
    group.push(row);
    dailyGroups.set(row.groupDate, group);
  }

  const dailyCards = Array.from(dailyGroups.entries())
    .map(([date, groupRows]) => {
      const ranked = rankBolaoRows(groupRows);
      return {
        date,
        ticketsCount: groupRows.length,
        playersCount: new Set(groupRows.map((row) => row.userId)).size,
        totalPoints: groupRows.reduce((acc, row) => acc + row.scorePoints, 0),
        availableCount: groupRows.filter((row) => bolaoUsageStatus(row) === "available").length,
        inUseCount: groupRows.filter((row) => bolaoUsageStatus(row) === "in_use").length,
        finishedCount: groupRows.filter((row) => bolaoUsageStatus(row) === "finished").length,
        topRows: ranked.slice(0, 3),
      };
    })
    .sort((a, b) => {
      const [ad, am, ay] = a.date.split("/").map(Number);
      const [bd, bm, by] = b.date.split("/").map(Number);
      return Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
    });

  const selectedDailyDateSafe = selectedDailyDate && dailyGroups.has(selectedDailyDate)
    ? selectedDailyDate
    : dailyCards[0]?.date ?? null;
  const selectedDailyRanking = selectedDailyDateSafe
    ? rankBolaoRows(dailyGroups.get(selectedDailyDateSafe) ?? [])
    : [];

  return {
    principal: {
      ticketsCount: principalRanking.length,
      playersCount: new Set(principalRanking.map((row) => row.userId)).size,
      totalPoints: principalRanking.reduce((acc, row) => acc + row.scorePoints, 0),
      ranking: principalRanking,
    },
    dailyCards,
    selectedDailyDate: selectedDailyDateSafe,
    selectedDailyRanking,
  };
}

export async function getAdminAffiliateDashboardData(): Promise<AdminAffiliateDashboardData> {
  const pool = getPool();
  const [stats, affiliates, referredUsers, commissions] = await Promise.all([
    getAdminAffiliateStats(),
    pool.query<{
      id: string;
      name: string | null;
      email: string;
      referral_code: string | null;
      affiliate_mode: string | null;
      influencer_cpa_bps: number | null;
      referred_users_count: string | number;
      paid_referrals_count: string | number;
      commissions_count: string | number;
      commissions_cents: string | number | null;
      created_at: Date;
    }>(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.referral_code,
         COALESCE(u.affiliate_mode, 'standard') AS affiliate_mode,
         COALESCE(u.influencer_cpa_bps, 0) AS influencer_cpa_bps,
         (SELECT COUNT(*) FROM users referred WHERE referred.referred_by_user_id::text = u.id::text) AS referred_users_count,
         (
           SELECT COUNT(DISTINCT referred.id)
           FROM users referred
           JOIN tickets paid_tickets ON paid_tickets.user_id::text = referred.id::text AND paid_tickets.status = 'paid'
           WHERE referred.referred_by_user_id::text = u.id::text
         ) AS paid_referrals_count,
         (SELECT COUNT(*) FROM referral_commissions c WHERE c.referrer_user_id::text = u.id::text) AS commissions_count,
         (SELECT COALESCE(SUM(c.amount_cents), 0) FROM referral_commissions c WHERE c.referrer_user_id::text = u.id::text) AS commissions_cents,
         u.created_at
       FROM users u
       WHERE u.referral_code IS NOT NULL
          OR EXISTS (SELECT 1 FROM users referred WHERE referred.referred_by_user_id::text = u.id::text)
          OR EXISTS (SELECT 1 FROM referral_commissions c WHERE c.referrer_user_id::text = u.id::text)
       ORDER BY referred_users_count DESC, commissions_cents DESC, u.created_at DESC`
    ),
    pool.query<{
      id: string;
      name: string | null;
      email: string;
      cpf: string | null;
      referrer_id: string;
      referrer_name: string | null;
      referrer_email: string;
      paid_tickets_count: string | number;
      created_at: Date;
    }>(
      `SELECT
         referred.id,
         referred.name,
         referred.email,
         referred.cpf,
         referrer.id AS referrer_id,
         referrer.name AS referrer_name,
         referrer.email AS referrer_email,
         COUNT(t.id) FILTER (WHERE t.status = 'paid') AS paid_tickets_count,
         referred.created_at
       FROM users referred
       JOIN users referrer ON referrer.id::text = referred.referred_by_user_id::text
       LEFT JOIN tickets t ON t.user_id::text = referred.id::text
       WHERE referred.referred_by_user_id IS NOT NULL
       GROUP BY referred.id, referrer.id
       ORDER BY referred.created_at DESC`
    ),
    pool.query<{
      id: string;
      referrer_name: string | null;
      referrer_email: string;
      referred_name: string | null;
      referred_email: string;
      amount_cents: number;
      tier: string;
      commission_index: number;
      commission_model: "standard" | "influencer";
      cpa_bps: number | null;
      base_amount_cents: number | null;
      created_at: Date;
    }>(
      `SELECT
         c.id,
         referrer.name AS referrer_name,
         referrer.email AS referrer_email,
         referred.name AS referred_name,
         referred.email AS referred_email,
         c.amount_cents,
         c.tier,
         c.commission_index,
         COALESCE(c.commission_model, 'standard') AS commission_model,
         c.cpa_bps,
         c.base_amount_cents,
         c.created_at
       FROM referral_commissions c
       JOIN users referrer ON referrer.id::text = c.referrer_user_id::text
       JOIN users referred ON referred.id::text = c.referred_user_id::text
       ORDER BY c.created_at DESC`
    ),
  ]);

  return {
    stats,
    affiliates: affiliates.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      referralCode: row.referral_code,
      affiliateMode: row.affiliate_mode === "influencer" ? "influencer" : "standard",
      influencerCpaBps: Number(row.influencer_cpa_bps ?? 0),
      referredUsersCount: Number(row.referred_users_count ?? 0),
      paidReferralsCount: Number(row.paid_referrals_count ?? 0),
      commissionsCount: Number(row.commissions_count ?? 0),
      commissionsCents: Number(row.commissions_cents ?? 0),
      createdAt: row.created_at.toISOString(),
    })),
    referredUsers: referredUsers.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      cpf: row.cpf,
      referrerId: row.referrer_id,
      referrerName: row.referrer_name,
      referrerEmail: row.referrer_email,
      paidTicketsCount: Number(row.paid_tickets_count ?? 0),
      createdAt: row.created_at.toISOString(),
    })),
    commissions: commissions.rows.map((row) => ({
      id: row.id,
      referrerName: row.referrer_name,
      referrerEmail: row.referrer_email,
      referredName: row.referred_name,
      referredEmail: row.referred_email,
      amountCents: row.amount_cents,
      tier: row.tier,
      commissionIndex: row.commission_index,
      commissionModel: row.commission_model,
      cpaBps: row.cpa_bps,
      baseAmountCents: row.base_amount_cents,
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export async function getAdminPredictionStats(): Promise<AdminPredictionStats> {
  const pool = getPool();
  const { rows } = await pool.query<{
    predictions_count: string | number;
    players_count: string | number;
    tickets_count: string | number;
  }>(
    `SELECT
       COUNT(*) AS predictions_count,
       COUNT(DISTINCT user_id) AS players_count,
       COUNT(DISTINCT ticket_id) AS tickets_count
     FROM predictions`
  );
  const row = rows[0];
  return {
    predictionsCount: Number(row?.predictions_count ?? 0),
    playersCount: Number(row?.players_count ?? 0),
    ticketsCount: Number(row?.tickets_count ?? 0),
  };
}

export async function listAdminPredictions(): Promise<AdminPredictionListItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string;
    ticket_id: string;
    ticket_type: string | null;
    bolao_type: string;
    match_id: number;
    home_name: string | null;
    home_logo: string | null;
    away_name: string | null;
    away_logo: string | null;
    date_br: string | null;
    hour_br: string | null;
    match_status: string | null;
    score_casa: number;
    score_visitante: number;
    result_casa: number | null;
    result_visitante: number | null;
    points: string | number | null;
    submitted_at: Date;
    updated_at: Date;
  }>(
    `SELECT
       p.id,
       p.user_id,
       u.name AS user_name,
       u.email AS user_email,
       p.ticket_id,
       t.ticket_type,
       p.bolao_type,
       p.match_id,
       mc.home_name,
       mc.home_logo,
       mc.away_name,
       mc.away_logo,
       mc.date_br,
       mc.hour_br,
       mc.status AS match_status,
       p.score_casa,
       p.score_visitante,
       mc.result_casa,
       mc.result_visitante,
       CASE
         WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
         WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 6
         WHEN (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
           OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
           OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
         THEN CASE
           WHEN p.score_casa = mc.result_casa OR p.score_visitante = mc.result_visitante THEN 4
           ELSE 3
         END
         ELSE
           CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
           + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
       END AS points,
       p.submitted_at,
       p.updated_at
     FROM predictions p
     LEFT JOIN users u ON u.id::text = p.user_id::text
     LEFT JOIN tickets t ON t.id::text = p.ticket_id::text
     LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
     ORDER BY p.submitted_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    ticketId: row.ticket_id,
    ticketType: row.ticket_type,
    bolaoType: row.bolao_type,
    matchId: Number(row.match_id),
    homeName: row.home_name ?? "Time casa",
    homeLogo: row.home_logo,
    awayName: row.away_name ?? "Time visitante",
    awayLogo: row.away_logo,
    matchDateBR: row.date_br,
    matchHourBR: row.hour_br,
    matchStatus: row.match_status,
    scoreCasa: row.score_casa,
    scoreVisitante: row.score_visitante,
    resultCasa: row.result_casa,
    resultVisitante: row.result_visitante,
    points: Number(row.points ?? 0),
    submittedAt: row.submitted_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function getAdminTransactionStats(): Promise<AdminTransactionStats> {
  const pool = getPool();
  const { rows } = await pool.query<{
    total_count: string | number;
    paid_count: string | number;
    pending_count: string | number;
    failed_count: string | number;
    paid_amount_cents: string | number | null;
  }>(
    `SELECT
       COUNT(*) AS total_count,
       COUNT(*) FILTER (WHERE status IN ('paid', 'approved')) AS paid_count,
       COUNT(*) FILTER (WHERE status IN ('pending_payment', 'pending', 'creating', 'waiting_payment')) AS pending_count,
       COUNT(*) FILTER (WHERE status IN ('failed', 'canceled', 'cancelled', 'refused', 'expired')) AS failed_count,
       COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('paid', 'approved')), 0) AS paid_amount_cents
     FROM transactions`
  );
  const row = rows[0];
  return {
    totalCount: Number(row?.total_count ?? 0),
    paidCount: Number(row?.paid_count ?? 0),
    pendingCount: Number(row?.pending_count ?? 0),
    failedCount: Number(row?.failed_count ?? 0),
    paidAmountCents: Number(row?.paid_amount_cents ?? 0),
  };
}

export async function listAdminTransactions(limit = 120): Promise<AdminTransactionListItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    provider_transaction_id: string | null;
    user_id: string;
    user_name: string | null;
    user_email: string;
    ticket_id: string | null;
    ticket_type: string;
    provider: string;
    payment_method: string;
    status: string;
    amount_cents: number;
    external_ref: string | null;
    pix_end2end_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT
       tx.id,
       tx.provider_transaction_id,
       tx.user_id,
       u.name AS user_name,
       u.email AS user_email,
       tx.ticket_id,
       tx.ticket_type,
       tx.provider,
       tx.payment_method,
       tx.status,
       tx.amount_cents,
       tx.external_ref,
       tx.pix_end2end_id,
       tx.created_at,
       tx.updated_at
     FROM transactions tx
     LEFT JOIN users u ON u.id::text = tx.user_id::text
     ORDER BY tx.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(300, limit))]
  );

  return rows.map((row) => ({
    id: row.id,
    providerTransactionId: row.provider_transaction_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    ticketId: row.ticket_id,
    ticketType: row.ticket_type,
    provider: row.provider,
    paymentMethod: row.payment_method,
    status: row.status,
    amountCents: row.amount_cents,
    externalRef: row.external_ref,
    pixEnd2EndId: row.pix_end2end_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function listAdminTickets(limit = 80): Promise<AdminTicketListItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_name: string | null;
    user_email: string;
    ticket_type: string;
    status: string;
    unit_price_cents: number;
    quantity: number;
    total_amount_cents: number;
    external_ref: string | null;
    paid_at: Date | null;
    created_at: Date;
    predictions_count: string | number;
    pending_predictions_count: string | number;
    total_matches_count: string | number;
    score_points: string | number | null;
    ranking_position: string | number | null;
    last_prediction_at: Date | null;
  }>(
    `WITH prediction_counts AS (
       SELECT ticket_id, COUNT(*) AS predictions_count, MAX(updated_at) AS last_prediction_at
       FROM predictions
       GROUP BY ticket_id
     ),
     first_prediction_dates AS (
       SELECT DISTINCT ON (p.ticket_id) p.ticket_id, mc.date_br
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE mc.date_br IS NOT NULL
       ORDER BY p.ticket_id, p.submitted_at ASC
     ),
     next_match_date AS (
       SELECT date_br
       FROM matches_cache
       ORDER BY
         CASE
           WHEN to_date(date_br, 'DD/MM/YYYY') >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0
           ELSE 1
         END,
         to_date(date_br, 'DD/MM/YYYY') ASC
       LIMIT 1
     ),
     prediction_scores AS (
       SELECT
         p.ticket_id,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 6
             WHEN (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             THEN CASE
               WHEN p.score_casa = mc.result_casa OR p.score_visitante = mc.result_visitante THEN 4
               ELSE 3
             END
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS score_points,
         COUNT(*) FILTER (WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL AND p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante) AS exact_count,
         COUNT(*) FILTER (
           WHERE mc.result_casa IS NOT NULL
             AND mc.result_visitante IS NOT NULL
             AND (
               (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             )
         ) AS outcome_count,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 0
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS goals_count,
         MIN(p.submitted_at) AS first_submit_at
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL
       GROUP BY p.ticket_id
     ),
     ranking_positions AS (
       SELECT
         rb.id,
         RANK() OVER (
           PARTITION BY rb.ticket_type, rb.ranking_group
           ORDER BY rb.score_points DESC, rb.exact_count DESC, rb.outcome_count DESC, rb.goals_count DESC, rb.first_submit_at ASC NULLS LAST
         ) AS ranking_position
       FROM (
         SELECT
           t.id,
           t.ticket_type,
           CASE WHEN t.ticket_type = 'daily' THEN COALESCE(fpd.date_br, 'SEM_DATA') ELSE 'GERAL' END AS ranking_group,
           COALESCE(ps.score_points, 0) AS score_points,
           COALESCE(ps.exact_count, 0) AS exact_count,
           COALESCE(ps.outcome_count, 0) AS outcome_count,
           COALESCE(ps.goals_count, 0) AS goals_count,
           ps.first_submit_at
         FROM tickets t
         LEFT JOIN first_prediction_dates fpd ON fpd.ticket_id::text = t.id::text
         JOIN prediction_scores ps ON ps.ticket_id::text = t.id::text
         WHERE t.status IN ('paid', 'approved')
       ) rb
     )
     SELECT
       t.id,
       u.name AS user_name,
       u.email AS user_email,
       t.ticket_type,
       t.status,
       t.unit_price_cents,
       t.quantity,
       t.total_amount_cents,
       t.external_ref,
       t.paid_at,
       t.created_at,
       COALESCE(pc.predictions_count, 0) AS predictions_count,
       GREATEST(
         CASE
           WHEN t.ticket_type = 'daily' THEN (
             SELECT COUNT(*)
             FROM matches_cache mc
             WHERE mc.date_br = COALESCE(fpd.date_br, (SELECT date_br FROM next_match_date))
           )
           ELSE (SELECT COUNT(*) FROM matches_cache)
         END - COALESCE(pc.predictions_count, 0),
         0
       ) AS pending_predictions_count,
       CASE
         WHEN t.ticket_type = 'daily' THEN (
           SELECT COUNT(*)
           FROM matches_cache mc
           WHERE mc.date_br = COALESCE(fpd.date_br, (SELECT date_br FROM next_match_date))
         )
         ELSE (SELECT COUNT(*) FROM matches_cache)
       END AS total_matches_count,
       COALESCE(ps.score_points, 0) AS score_points,
       rp.ranking_position,
       pc.last_prediction_at
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN prediction_counts pc ON pc.ticket_id::text = t.id::text
     LEFT JOIN first_prediction_dates fpd ON fpd.ticket_id::text = t.id::text
     LEFT JOIN prediction_scores ps ON ps.ticket_id::text = t.id::text
     LEFT JOIN ranking_positions rp ON rp.id::text = t.id::text
     WHERE t.status IN ('paid', 'approved')
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(200, limit))]
  );
  return rows.map((row) => ({
    id: row.id,
    userName: row.user_name,
    userEmail: row.user_email,
    ticketType: row.ticket_type,
    status: row.status,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    totalAmountCents: row.total_amount_cents,
    externalRef: row.external_ref,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    predictionsCount: Number(row.predictions_count ?? 0),
    pendingPredictionsCount: Number(row.pending_predictions_count ?? 0),
    totalMatchesCount: Number(row.total_matches_count ?? 0),
    scorePoints: Number(row.score_points ?? 0),
    rankingPosition: row.ranking_position == null ? null : Number(row.ranking_position),
    lastPredictionAt: row.last_prediction_at ? row.last_prediction_at.toISOString() : null,
  }));
}

export async function getAdminTicketDetail(ticketId: string): Promise<AdminTicketDetail | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string;
    user_cpf: string | null;
    user_phone: string | null;
    ticket_type: string;
    status: string;
    unit_price_cents: number;
    quantity: number;
    total_amount_cents: number;
    external_ref: string | null;
    paid_at: Date | null;
    created_at: Date;
    predictions_count: string | number;
    pending_predictions_count: string | number;
    total_matches_count: string | number;
    score_points: string | number | null;
    ranking_position: string | number | null;
    last_prediction_at: Date | null;
    transaction_id: string | null;
    provider_transaction_id: string | null;
    transaction_status: string | null;
    transaction_amount_cents: number | null;
    transaction_created_at: Date | null;
  }>(
    `WITH prediction_counts AS (
       SELECT ticket_id, COUNT(*) AS predictions_count, MAX(updated_at) AS last_prediction_at
       FROM predictions
       WHERE ticket_id::text = $1::text
       GROUP BY ticket_id
     ),
     first_prediction_date AS (
       SELECT mc.date_br
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE p.ticket_id::text = $1::text AND mc.date_br IS NOT NULL
       ORDER BY p.submitted_at ASC
       LIMIT 1
     ),
     next_match_date AS (
       SELECT date_br
       FROM matches_cache
       ORDER BY
         CASE
           WHEN to_date(date_br, 'DD/MM/YYYY') >= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0
           ELSE 1
         END,
         to_date(date_br, 'DD/MM/YYYY') ASC
       LIMIT 1
     ),
     all_first_prediction_dates AS (
       SELECT DISTINCT ON (p.ticket_id) p.ticket_id, mc.date_br
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE mc.date_br IS NOT NULL
       ORDER BY p.ticket_id, p.submitted_at ASC
     ),
     prediction_scores AS (
       SELECT
         p.ticket_id,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 6
             WHEN (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             THEN CASE
               WHEN p.score_casa = mc.result_casa OR p.score_visitante = mc.result_visitante THEN 4
               ELSE 3
             END
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS score_points,
         COUNT(*) FILTER (WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL AND p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante) AS exact_count,
         COUNT(*) FILTER (
           WHERE mc.result_casa IS NOT NULL
             AND mc.result_visitante IS NOT NULL
             AND (
               (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
               OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
               OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
             )
         ) AS outcome_count,
         SUM(
           CASE
             WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
             WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 0
             ELSE
               CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
               + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
           END
         ) AS goals_count,
         MIN(p.submitted_at) AS first_submit_at
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       WHERE mc.result_casa IS NOT NULL AND mc.result_visitante IS NOT NULL
       GROUP BY p.ticket_id
     ),
     ranking_positions AS (
       SELECT
         rb.id,
         RANK() OVER (
           PARTITION BY rb.ticket_type, rb.ranking_group
           ORDER BY rb.score_points DESC, rb.exact_count DESC, rb.outcome_count DESC, rb.goals_count DESC, rb.first_submit_at ASC NULLS LAST
         ) AS ranking_position
       FROM (
         SELECT
           t.id,
           t.ticket_type,
           CASE WHEN t.ticket_type = 'daily' THEN COALESCE(afpd.date_br, 'SEM_DATA') ELSE 'GERAL' END AS ranking_group,
           COALESCE(ps.score_points, 0) AS score_points,
           COALESCE(ps.exact_count, 0) AS exact_count,
           COALESCE(ps.outcome_count, 0) AS outcome_count,
           COALESCE(ps.goals_count, 0) AS goals_count,
           ps.first_submit_at
         FROM tickets t
         LEFT JOIN all_first_prediction_dates afpd ON afpd.ticket_id::text = t.id::text
         JOIN prediction_scores ps ON ps.ticket_id::text = t.id::text
         WHERE t.status IN ('paid', 'approved')
       ) rb
     )
     SELECT
       t.id,
       t.user_id,
       u.name AS user_name,
       u.email AS user_email,
       u.cpf AS user_cpf,
       u.phone AS user_phone,
       t.ticket_type,
       t.status,
       t.unit_price_cents,
       t.quantity,
       t.total_amount_cents,
       t.external_ref,
       t.paid_at,
       t.created_at,
       COALESCE(pc.predictions_count, 0) AS predictions_count,
       GREATEST(
         CASE
           WHEN t.ticket_type = 'daily' THEN (
             SELECT COUNT(*)
             FROM matches_cache mc
             WHERE mc.date_br = COALESCE((SELECT date_br FROM first_prediction_date), (SELECT date_br FROM next_match_date))
           )
           ELSE (SELECT COUNT(*) FROM matches_cache)
         END - COALESCE(pc.predictions_count, 0),
         0
       ) AS pending_predictions_count,
       CASE
         WHEN t.ticket_type = 'daily' THEN (
           SELECT COUNT(*)
           FROM matches_cache mc
           WHERE mc.date_br = COALESCE((SELECT date_br FROM first_prediction_date), (SELECT date_br FROM next_match_date))
         )
         ELSE (SELECT COUNT(*) FROM matches_cache)
       END AS total_matches_count,
       COALESCE(ps.score_points, 0) AS score_points,
       rp.ranking_position,
       pc.last_prediction_at,
       tx.id AS transaction_id,
       tx.provider_transaction_id,
       tx.status AS transaction_status,
       tx.amount_cents AS transaction_amount_cents,
       tx.created_at AS transaction_created_at
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN prediction_counts pc ON pc.ticket_id::text = t.id::text
    LEFT JOIN prediction_scores ps ON ps.ticket_id::text = t.id::text
    LEFT JOIN ranking_positions rp ON rp.id::text = t.id::text
     LEFT JOIN LATERAL (
       SELECT id, provider_transaction_id, status, amount_cents, created_at
       FROM transactions
       WHERE ticket_id::text = t.id::text OR (t.external_ref IS NOT NULL AND external_ref = t.external_ref)
       ORDER BY created_at DESC
       LIMIT 1
     ) tx ON true
     WHERE t.id = $1::uuid
     LIMIT 1`,
    [ticketId]
  );
  const row = rows[0];
  if (!row) return null;

  const { rows: predictionRows } = await pool.query<{
    id: string;
    match_id: number;
    home_name: string | null;
    home_logo: string | null;
    away_name: string | null;
    away_logo: string | null;
    date_br: string | null;
    hour_br: string | null;
    status: string | null;
    score_casa: number;
    score_visitante: number;
    result_casa: number | null;
    result_visitante: number | null;
    points: string | number | null;
    submitted_at: Date;
    updated_at: Date;
  }>(
    `SELECT
       p.id,
       p.match_id,
       mc.home_name,
       mc.home_logo,
       mc.away_name,
       mc.away_logo,
       mc.date_br,
       mc.hour_br,
       mc.status,
       p.score_casa,
       p.score_visitante,
       mc.result_casa,
       mc.result_visitante,
       CASE
         WHEN mc.result_casa IS NULL OR mc.result_visitante IS NULL THEN 0
         WHEN p.score_casa = mc.result_casa AND p.score_visitante = mc.result_visitante THEN 6
         WHEN (p.score_casa - p.score_visitante = 0 AND mc.result_casa - mc.result_visitante = 0)
           OR (p.score_casa - p.score_visitante > 0 AND mc.result_casa - mc.result_visitante > 0)
           OR (p.score_casa - p.score_visitante < 0 AND mc.result_casa - mc.result_visitante < 0)
         THEN CASE
           WHEN p.score_casa = mc.result_casa OR p.score_visitante = mc.result_visitante THEN 4
           ELSE 3
         END
         ELSE
           CASE WHEN p.score_casa = mc.result_casa THEN 1 ELSE 0 END
           + CASE WHEN p.score_visitante = mc.result_visitante THEN 1 ELSE 0 END
       END AS points,
       p.submitted_at,
       p.updated_at
     FROM predictions p
     LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
     WHERE p.ticket_id::text = $1::text
     ORDER BY p.submitted_at DESC`,
    [ticketId]
  );

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userCpf: row.user_cpf,
    userPhone: row.user_phone,
    ticketType: row.ticket_type,
    status: row.status,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    totalAmountCents: row.total_amount_cents,
    externalRef: row.external_ref,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    predictionsCount: Number(row.predictions_count ?? 0),
    pendingPredictionsCount: Number(row.pending_predictions_count ?? 0),
    totalMatchesCount: Number(row.total_matches_count ?? 0),
    scorePoints: Number(row.score_points ?? 0),
    rankingPosition: row.ranking_position == null ? null : Number(row.ranking_position),
    lastPredictionAt: row.last_prediction_at ? row.last_prediction_at.toISOString() : null,
    transactionId: row.transaction_id,
    providerTransactionId: row.provider_transaction_id,
    transactionStatus: row.transaction_status,
    transactionAmountCents: row.transaction_amount_cents,
    transactionCreatedAt: row.transaction_created_at ? row.transaction_created_at.toISOString() : null,
    predictions: predictionRows.map((prediction) => ({
      id: prediction.id,
      matchId: Number(prediction.match_id),
      homeName: prediction.home_name ?? "Time casa",
      awayName: prediction.away_name ?? "Time visitante",
      homeLogo: prediction.home_logo,
      awayLogo: prediction.away_logo,
      dateBR: prediction.date_br,
      hourBR: prediction.hour_br,
      status: prediction.status,
      scoreCasa: prediction.score_casa,
      scoreVisitante: prediction.score_visitante,
      resultCasa: prediction.result_casa,
      resultVisitante: prediction.result_visitante,
      points: Number(prediction.points ?? 0),
      submittedAt: prediction.submitted_at.toISOString(),
      updatedAt: prediction.updated_at.toISOString(),
    })),
  };
}
