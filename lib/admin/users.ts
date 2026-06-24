import {
  SQL_TICKET_ACTIVE,
  SQL_TICKET_PAID,
  SQL_TICKET_PAID_BARE,
  SQL_TICKET_PROMO_BARE,
} from "@/lib/admin/ticket-count-sql";
import { formatAdminTicketLabel } from "@/lib/admin/format";
import { getPool } from "@/lib/db";

export type AdminUserListItem = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  role: "user" | "admin" | "super_admin";
  twoFactorEnabled: boolean;
  ticketsCount: number;
  paidTicketsCount: number;
  scorePoints: number;
  affiliateMode: "standard" | "influencer";
  influencerCpaBps: number;
  balanceCents: number;
  affiliateBalanceCents: number;
  createdAt: string;
};

export type AdminUserTicketItem = {
  id: string;
  displayName: string;
  ticketType: string;
  status: string;
  totalAmountCents: number;
  predictionsCount: number;
  paidAt: string | null;
  createdAt: string;
};

export type AdminUserReferredItem = {
  id: string;
  name: string | null;
  email: string;
  cpf: string | null;
  paidTicketsCount: number;
  ticketsCount: number;
  createdAt: string;
};

export type AdminUserDetail = AdminUserListItem & {
  referredByUserId: string | null;
  referralCode: string | null;
  emailVerifiedAt: string | null;
  transactionsCount: number;
  paidTransactionsCount: number;
  revenueCents: number;
  predictionsCount: number;
  referredUsersCount: number;
  commissionsCents: number;
  tickets: AdminUserTicketItem[];
  referredUsers: AdminUserReferredItem[];
};

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    cpf: string | null;
    role: string | null;
    admin_2fa_enabled: boolean | null;
    affiliate_mode: string | null;
    influencer_cpa_bps: number | null;
    balance_cents: number | null;
    affiliate_balance_cents: number | null;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    score_points: string | number | null;
    created_at: Date;
  }>(
    `WITH user_scores AS (
       SELECT
         p.user_id,
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
         ) AS score_points
       FROM predictions p
       LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
       GROUP BY p.user_id
     )
     SELECT
       u.id,
       u.email,
       u.name,
       u.phone,
       u.cpf,
       COALESCE(u.role, 'user') AS role,
       COALESCE(u.admin_2fa_enabled, false) AS admin_2fa_enabled,
       COALESCE(u.affiliate_mode, 'standard') AS affiliate_mode,
       COALESCE(u.influencer_cpa_bps, 0) AS influencer_cpa_bps,
       COALESCE(u.balance_cents, 0) AS balance_cents,
       COALESCE(u.affiliate_balance_cents, 0) AS affiliate_balance_cents,
       COUNT(t.id) FILTER (WHERE ${SQL_TICKET_ACTIVE}) AS tickets_count,
       COUNT(t.id) FILTER (WHERE ${SQL_TICKET_PAID}) AS paid_tickets_count,
       COALESCE(us.score_points, 0) AS score_points,
       u.created_at
     FROM users u
     LEFT JOIN tickets t ON t.user_id::text = u.id::text
     LEFT JOIN user_scores us ON us.user_id::text = u.id::text
     GROUP BY u.id, us.score_points
     ORDER BY u.created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    cpf: row.cpf,
    role: row.role === "super_admin" || row.role === "admin" ? row.role : "user",
    twoFactorEnabled: Boolean(row.admin_2fa_enabled),
    affiliateMode: row.affiliate_mode === "influencer" ? "influencer" : "standard",
    influencerCpaBps: Number(row.influencer_cpa_bps ?? 0),
    balanceCents: Number(row.balance_cents ?? 0),
    affiliateBalanceCents: Number(row.affiliate_balance_cents ?? 0),
    ticketsCount: Number(row.tickets_count ?? 0),
    paidTicketsCount: Number(row.paid_tickets_count ?? 0),
    scorePoints: Number(row.score_points ?? 0),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    cpf: string | null;
    role: string | null;
    admin_2fa_enabled: boolean | null;
    affiliate_mode: string | null;
    influencer_cpa_bps: number | null;
    balance_cents: number | null;
    affiliate_balance_cents: number | null;
    referral_code: string | null;
    referred_by_user_id: string | null;
    email_verified_at: Date | null;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    transactions_count: string | number;
    paid_transactions_count: string | number;
    revenue_cents: string | number | null;
    predictions_count: string | number;
    score_points: string | number | null;
    referred_users_count: string | number;
    commissions_cents: string | number | null;
    created_at: Date;
  }>(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.phone,
       u.cpf,
       COALESCE(u.role, 'user') AS role,
       COALESCE(u.admin_2fa_enabled, false) AS admin_2fa_enabled,
       COALESCE(u.affiliate_mode, 'standard') AS affiliate_mode,
       COALESCE(u.influencer_cpa_bps, 0) AS influencer_cpa_bps,
       COALESCE(u.balance_cents, 0) AS balance_cents,
       COALESCE(u.affiliate_balance_cents, 0) AS affiliate_balance_cents,
       u.referral_code,
       u.referred_by_user_id,
       u.email_verified_at,
       (SELECT COUNT(*) FROM tickets t WHERE t.user_id::text = u.id::text AND ${SQL_TICKET_ACTIVE}) AS tickets_count,
       (SELECT COUNT(*) FROM tickets t WHERE t.user_id::text = u.id::text AND ${SQL_TICKET_PAID}) AS paid_tickets_count,
       (SELECT COUNT(*) FROM transactions tx WHERE tx.user_id::text = u.id::text) AS transactions_count,
       (SELECT COUNT(*) FROM transactions tx WHERE tx.user_id::text = u.id::text AND tx.status IN ('paid', 'approved')) AS paid_transactions_count,
       (SELECT COALESCE(SUM(tx.amount_cents), 0) FROM transactions tx WHERE tx.user_id::text = u.id::text AND tx.status IN ('paid', 'approved')) AS revenue_cents,
       (SELECT COUNT(*) FROM predictions p WHERE p.user_id::text = u.id::text) AS predictions_count,
       (
         SELECT COALESCE(SUM(
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
         ), 0)
         FROM predictions p
         LEFT JOIN matches_cache mc ON mc.match_id = p.match_id
         WHERE p.user_id::text = u.id::text
       ) AS score_points,
       (SELECT COUNT(*) FROM users referred WHERE referred.referred_by_user_id::text = u.id::text) AS referred_users_count,
       (SELECT COALESCE(SUM(c.amount_cents), 0) FROM referral_commissions c WHERE c.referrer_user_id::text = u.id::text) AS commissions_cents,
       u.created_at
     FROM users u
     WHERE u.id::text = $1::text
     LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;

  const [ticketRowsResult, referredRowsResult] = await Promise.all([
    pool.query<{
    id: string;
    ticket_type: string;
    extra_championship_id: number | null;
    round_number: number | null;
    bolao_definition_name: string | null;
    status: string;
    total_amount_cents: number;
    predictions_count: string | number;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `SELECT
       t.id,
       t.ticket_type,
       t.extra_championship_id,
       t.round_number,
       bd.display_name AS bolao_definition_name,
       t.status,
       t.total_amount_cents,
       COUNT(p.id) AS predictions_count,
       t.paid_at,
       t.created_at
     FROM tickets t
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text
     LEFT JOIN bolao_definitions bd ON bd.id = t.bolao_definition_id
     WHERE t.user_id::text = $1::text
     GROUP BY t.id, t.ticket_type, t.extra_championship_id, t.round_number, bd.display_name,
              t.status, t.total_amount_cents, t.paid_at, t.created_at
     ORDER BY t.created_at DESC
     LIMIT 80`,
    [userId]
    ),
    pool.query<{
    id: string;
    name: string | null;
    email: string;
    cpf: string | null;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    created_at: Date;
  }>(
    `SELECT
       referred.id,
       referred.name,
       referred.email,
       referred.cpf,
       COUNT(t.id) FILTER (WHERE ${SQL_TICKET_ACTIVE}) AS tickets_count,
       COUNT(t.id) FILTER (WHERE ${SQL_TICKET_PAID}) AS paid_tickets_count,
       referred.created_at
     FROM users referred
     LEFT JOIN tickets t ON t.user_id::text = referred.id::text
     WHERE referred.referred_by_user_id::text = $1::text
     GROUP BY referred.id
     ORDER BY referred.created_at DESC`,
    [userId]
    ),
  ]);

  const ticketRows = ticketRowsResult.rows;
  const referredRows = referredRowsResult.rows;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    cpf: row.cpf,
    role: row.role === "super_admin" || row.role === "admin" ? row.role : "user",
    twoFactorEnabled: Boolean(row.admin_2fa_enabled),
    affiliateMode: row.affiliate_mode === "influencer" ? "influencer" : "standard",
    influencerCpaBps: Number(row.influencer_cpa_bps ?? 0),
    balanceCents: Number(row.balance_cents ?? 0),
    affiliateBalanceCents: Number(row.affiliate_balance_cents ?? 0),
    ticketsCount: Number(row.tickets_count ?? 0),
    paidTicketsCount: Number(row.paid_tickets_count ?? 0),
    scorePoints: Number(row.score_points ?? 0),
    createdAt: row.created_at.toISOString(),
    referredByUserId: row.referred_by_user_id,
    referralCode: row.referral_code,
    emailVerifiedAt: row.email_verified_at ? row.email_verified_at.toISOString() : null,
    transactionsCount: Number(row.transactions_count ?? 0),
    paidTransactionsCount: Number(row.paid_transactions_count ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0),
    predictionsCount: Number(row.predictions_count ?? 0),
    referredUsersCount: Number(row.referred_users_count ?? 0),
    commissionsCents: Number(row.commissions_cents ?? 0),
    tickets: ticketRows.map((ticket) => ({
      id: ticket.id,
      displayName: formatAdminTicketLabel({
        ticketType: ticket.ticket_type,
        extraChampionshipId: ticket.extra_championship_id,
        roundNumber: ticket.round_number,
        bolaoDefinitionName: ticket.bolao_definition_name,
      }),
      ticketType: ticket.ticket_type,
      status: ticket.status,
      totalAmountCents: ticket.total_amount_cents,
      predictionsCount: Number(ticket.predictions_count ?? 0),
      paidAt: ticket.paid_at ? ticket.paid_at.toISOString() : null,
      createdAt: ticket.created_at.toISOString(),
    })),
    referredUsers: referredRows.map((referred) => ({
      id: referred.id,
      name: referred.name,
      email: referred.email,
      cpf: referred.cpf,
      ticketsCount: Number(referred.tickets_count ?? 0),
      paidTicketsCount: Number(referred.paid_tickets_count ?? 0),
      createdAt: referred.created_at.toISOString(),
    })),
  };
}

export type AdminDashboardSeriesPoint = {
  date: string;
  label: string;
  usersCount: number;
  transactionsCount: number;
  paidTransactionsCount: number;
  revenueCents: number;
};

export type AdminDashboardBreakdownItem = {
  label: string;
  value: number;
};

export type AdminDashboardTicketTypeItem = {
  label: string;
  paidCount: number;
  promoCount: number;
};

export type AdminDashboardData = {
  usersCount: number;
  adminsCount: number;
  ticketsCount: number;
  paidTicketsCount: number;
  promoTicketsCount: number;
  transactionsCount: number;
  paidTransactionsCount: number;
  pendingTransactionsCount: number;
  failedTransactionsCount: number;
  revenueCents: number;
  usersTodayCount: number;
  conversionRate: number;
  dailySeries: AdminDashboardSeriesPoint[];
  ticketTypeBreakdown: AdminDashboardTicketTypeItem[];
  transactionStatusBreakdown: AdminDashboardBreakdownItem[];
};

const DASHBOARD_TZ = "America/Sao_Paulo";

/** Intervalo [início, fim+1dia) no fuso de São Paulo — alinha filtro do dashboard ao calendário BR. */
function sqlBrTimestampRange(column: string, startParam = "$1", endParam = "$2"): string {
  return `${column} >= (${startParam}::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}'
    AND ${column} < (${endParam}::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}' + interval '1 day'`;
}

function sqlBrDateEquals(column: string, dayColumn: string): string {
  return `(${column} AT TIME ZONE '${DASHBOARD_TZ}')::date = ${dayColumn}`;
}

function dashboardRangeDays(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

export async function getAdminDashboardStats(input: {
  startDate: string;
  endDate: string;
}): Promise<AdminDashboardData> {
  const pool = getPool();
  const params = [input.startDate, input.endDate];
  const brTicketRange = sqlBrTimestampRange("created_at");
  const brUserRange = sqlBrTimestampRange("u.created_at");
  const brTxRangeBare = sqlBrTimestampRange("created_at");
  const sameDay = input.startDate === input.endDate;
  const longRange = !sameDay && dashboardRangeDays(input.startDate, input.endDate) > 14;
  const seriesParams = sameDay ? [input.startDate] : params;
  const seriesQuery = sameDay
    ? `WITH slots AS (
         SELECT generate_series(
           ($1::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}',
           ($1::text || ' 20:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}',
           interval '4 hours'
         ) AS period_start
       )
       SELECT
         slots.period_start AS day,
         to_char(slots.period_start AT TIME ZONE '${DASHBOARD_TZ}', 'HH24"h"') AS label,
         (SELECT COUNT(*) FROM users u WHERE u.created_at >= slots.period_start AND u.created_at < slots.period_start + interval '4 hours') AS users_count,
         (SELECT COUNT(*) FROM transactions tx WHERE tx.created_at >= slots.period_start AND tx.created_at < slots.period_start + interval '4 hours') AS transactions_count,
         (SELECT COUNT(*) FROM transactions tx WHERE tx.created_at >= slots.period_start AND tx.created_at < slots.period_start + interval '4 hours' AND tx.status IN ('paid', 'approved')) AS paid_transactions_count,
         (SELECT COALESCE(SUM(tx.amount_cents), 0) FROM transactions tx WHERE tx.created_at >= slots.period_start AND tx.created_at < slots.period_start + interval '4 hours' AND tx.status IN ('paid', 'approved')) AS revenue_cents
       FROM slots
       ORDER BY slots.period_start ASC`
    : longRange
      ? `WITH buckets AS (
           SELECT generate_series(
             ($1::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}',
             ($2::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}',
             interval '4 days'
           ) AS period_start
         ),
         bounds AS (
           SELECT
             period_start,
             LEAST(
               period_start + interval '4 days',
               ($2::text || ' 00:00:00')::timestamp AT TIME ZONE '${DASHBOARD_TZ}' + interval '1 day'
             ) AS period_end
           FROM buckets
         )
         SELECT
           bounds.period_start AS day,
           CASE
             WHEN (bounds.period_end - interval '1 day')::date = bounds.period_start::date
               THEN to_char(bounds.period_start AT TIME ZONE '${DASHBOARD_TZ}', 'DD/MM')
             ELSE to_char(bounds.period_start AT TIME ZONE '${DASHBOARD_TZ}', 'DD/MM') || '-' || to_char((bounds.period_end - interval '1 day') AT TIME ZONE '${DASHBOARD_TZ}', 'DD/MM')
           END AS label,
           (SELECT COUNT(*) FROM users u WHERE u.created_at >= bounds.period_start AND u.created_at < bounds.period_end) AS users_count,
           (SELECT COUNT(*) FROM transactions tx WHERE tx.created_at >= bounds.period_start AND tx.created_at < bounds.period_end) AS transactions_count,
           (SELECT COUNT(*) FROM transactions tx WHERE tx.created_at >= bounds.period_start AND tx.created_at < bounds.period_end AND tx.status IN ('paid', 'approved')) AS paid_transactions_count,
           (SELECT COALESCE(SUM(tx.amount_cents), 0) FROM transactions tx WHERE tx.created_at >= bounds.period_start AND tx.created_at < bounds.period_end AND tx.status IN ('paid', 'approved')) AS revenue_cents
         FROM bounds
         ORDER BY bounds.period_start ASC`
    : `WITH days AS (
         SELECT generate_series(
           $1::date,
           $2::date,
           interval '1 day'
         )::date AS day
       )
       SELECT
         days.day,
         to_char(days.day, 'DD/MM') AS label,
         (SELECT COUNT(*) FROM users u WHERE ${sqlBrDateEquals("u.created_at", "days.day")}) AS users_count,
         (SELECT COUNT(*) FROM transactions tx WHERE ${sqlBrDateEquals("tx.created_at", "days.day")}) AS transactions_count,
         (SELECT COUNT(*) FROM transactions tx WHERE ${sqlBrDateEquals("tx.created_at", "days.day")} AND tx.status IN ('paid', 'approved')) AS paid_transactions_count,
         (SELECT COALESCE(SUM(tx.amount_cents), 0) FROM transactions tx WHERE ${sqlBrDateEquals("tx.created_at", "days.day")} AND tx.status IN ('paid', 'approved')) AS revenue_cents
       FROM days
       ORDER BY days.day ASC`;
  const [summary, series, ticketTypes, statuses] = await Promise.all([
    pool.query<{
    users_count: string | number;
    admins_count: string | number;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    promo_tickets_count: string | number;
    transactions_count: string | number;
    paid_transactions_count: string | number;
    pending_transactions_count: string | number;
    failed_transactions_count: string | number;
    revenue_cents: string | number | null;
    users_today_count: string | number;
  }>(
      `SELECT
         (SELECT COUNT(*) FROM users u WHERE ${brUserRange}) AS users_count,
         (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')) AS admins_count,
         (SELECT COUNT(*) FROM tickets WHERE status IN ('paid', 'approved') AND ${brTicketRange}) AS tickets_count,
         (SELECT COUNT(*) FROM tickets WHERE ${SQL_TICKET_PAID_BARE} AND ${brTicketRange}) AS paid_tickets_count,
         (SELECT COUNT(*) FROM tickets WHERE ${SQL_TICKET_PROMO_BARE} AND ${brTicketRange}) AS promo_tickets_count,
         (SELECT COUNT(*) FROM transactions WHERE ${brTxRangeBare}) AS transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('paid', 'approved') AND ${brTxRangeBare}) AS paid_transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('pending_payment', 'pending', 'creating', 'waiting_payment') AND ${brTxRangeBare}) AS pending_transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('failed', 'canceled', 'cancelled', 'refused', 'expired') AND ${brTxRangeBare}) AS failed_transactions_count,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE status IN ('paid', 'approved') AND ${brTxRangeBare}) AS revenue_cents,
         (SELECT COUNT(*) FROM users u WHERE ${brUserRange}) AS users_today_count`,
      params
    ),
    pool.query<{
      day: Date;
      label: string;
      users_count: string | number;
      transactions_count: string | number;
      paid_transactions_count: string | number;
      revenue_cents: string | number | null;
    }>(seriesQuery, seriesParams),
    pool.query<{ label: string; paid_count: string | number; promo_count: string | number }>(
      `SELECT
         ticket_type AS label,
         COUNT(*) FILTER (WHERE ${SQL_TICKET_PAID_BARE}) AS paid_count,
         COUNT(*) FILTER (WHERE ${SQL_TICKET_PROMO_BARE}) AS promo_count
       FROM tickets
       WHERE status IN ('paid', 'approved')
         AND ${brTicketRange}
       GROUP BY ticket_type
       ORDER BY COUNT(*) DESC`,
      params
    ),
    pool.query<{ label: string; value: string | number }>(
      `SELECT status AS label, COUNT(*) AS value
       FROM transactions
       WHERE ${brTxRangeBare}
       GROUP BY status
       ORDER BY value DESC`,
      params
    ),
  ]);
  const row = summary.rows[0];
  const transactionsCount = Number(row?.transactions_count ?? 0);
  const paidTransactionsCount = Number(row?.paid_transactions_count ?? 0);

  return {
    usersCount: Number(row?.users_count ?? 0),
    adminsCount: Number(row?.admins_count ?? 0),
    ticketsCount: Number(row?.tickets_count ?? 0),
    paidTicketsCount: Number(row?.paid_tickets_count ?? 0),
    promoTicketsCount: Number(row?.promo_tickets_count ?? 0),
    transactionsCount,
    paidTransactionsCount,
    pendingTransactionsCount: Number(row?.pending_transactions_count ?? 0),
    failedTransactionsCount: Number(row?.failed_transactions_count ?? 0),
    revenueCents: Number(row?.revenue_cents ?? 0),
    usersTodayCount: Number(row?.users_today_count ?? 0),
    conversionRate: transactionsCount > 0 ? Math.round((paidTransactionsCount / transactionsCount) * 100) : 0,
    dailySeries: series.rows.map((point) => ({
      date: point.day.toISOString(),
      label: point.label,
      usersCount: Number(point.users_count ?? 0),
      transactionsCount: Number(point.transactions_count ?? 0),
      paidTransactionsCount: Number(point.paid_transactions_count ?? 0),
      revenueCents: Number(point.revenue_cents ?? 0),
    })),
    ticketTypeBreakdown: ticketTypes.rows.map((item) => ({
      label: item.label,
      paidCount: Number(item.paid_count ?? 0),
      promoCount: Number(item.promo_count ?? 0),
    })),
    transactionStatusBreakdown: statuses.rows.map((item) => ({
      label: item.label,
      value: Number(item.value ?? 0),
    })),
  };
}
