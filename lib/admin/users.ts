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
  createdAt: string;
};

export type AdminUserTicketItem = {
  id: string;
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
    tickets_count: string | number;
    paid_tickets_count: string | number;
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
       COUNT(t.id) AS tickets_count,
       COUNT(t.id) FILTER (WHERE t.status = 'paid') AS paid_tickets_count,
       u.created_at
     FROM users u
     LEFT JOIN tickets t ON t.user_id::text = u.id::text
     GROUP BY u.id
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
    ticketsCount: Number(row.tickets_count ?? 0),
    paidTicketsCount: Number(row.paid_tickets_count ?? 0),
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
    referral_code: string | null;
    referred_by_user_id: string | null;
    email_verified_at: Date | null;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    transactions_count: string | number;
    paid_transactions_count: string | number;
    revenue_cents: string | number | null;
    predictions_count: string | number;
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
       u.referral_code,
       u.referred_by_user_id,
       u.email_verified_at,
       (SELECT COUNT(*) FROM tickets t WHERE t.user_id::text = u.id::text) AS tickets_count,
       (SELECT COUNT(*) FROM tickets t WHERE t.user_id::text = u.id::text AND t.status = 'paid') AS paid_tickets_count,
       (SELECT COUNT(*) FROM transactions tx WHERE tx.user_id::text = u.id::text) AS transactions_count,
       (SELECT COUNT(*) FROM transactions tx WHERE tx.user_id::text = u.id::text AND tx.status IN ('paid', 'approved')) AS paid_transactions_count,
       (SELECT COALESCE(SUM(tx.amount_cents), 0) FROM transactions tx WHERE tx.user_id::text = u.id::text AND tx.status IN ('paid', 'approved')) AS revenue_cents,
       (SELECT COUNT(*) FROM predictions p WHERE p.user_id::text = u.id::text) AS predictions_count,
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

  const { rows: ticketRows } = await pool.query<{
    id: string;
    ticket_type: string;
    status: string;
    total_amount_cents: number;
    predictions_count: string | number;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `SELECT
       t.id,
       t.ticket_type,
       t.status,
       t.total_amount_cents,
       COUNT(p.id) AS predictions_count,
       t.paid_at,
       t.created_at
     FROM tickets t
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text
     WHERE t.user_id::text = $1::text
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT 80`,
    [userId]
  );

  const { rows: referredRows } = await pool.query<{
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
       COUNT(t.id) AS tickets_count,
       COUNT(t.id) FILTER (WHERE t.status = 'paid') AS paid_tickets_count,
       referred.created_at
     FROM users referred
     LEFT JOIN tickets t ON t.user_id::text = referred.id::text
     WHERE referred.referred_by_user_id::text = $1::text
     GROUP BY referred.id
     ORDER BY referred.created_at DESC`,
    [userId]
  );

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    cpf: row.cpf,
    role: row.role === "super_admin" || row.role === "admin" ? row.role : "user",
    twoFactorEnabled: Boolean(row.admin_2fa_enabled),
    ticketsCount: Number(row.tickets_count ?? 0),
    paidTicketsCount: Number(row.paid_tickets_count ?? 0),
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

export type AdminDashboardRecentTransaction = {
  id: string;
  userName: string | null;
  userEmail: string;
  status: string;
  amountCents: number;
  createdAt: string;
};

export type AdminDashboardData = {
  usersCount: number;
  adminsCount: number;
  ticketsCount: number;
  paidTicketsCount: number;
  transactionsCount: number;
  paidTransactionsCount: number;
  pendingTransactionsCount: number;
  failedTransactionsCount: number;
  revenueCents: number;
  usersTodayCount: number;
  conversionRate: number;
  dailySeries: AdminDashboardSeriesPoint[];
  ticketTypeBreakdown: AdminDashboardBreakdownItem[];
  transactionStatusBreakdown: AdminDashboardBreakdownItem[];
  recentTransactions: AdminDashboardRecentTransaction[];
};

export async function getAdminDashboardStats(): Promise<AdminDashboardData> {
  const pool = getPool();
  const [summary, series, ticketTypes, statuses, recentTransactions] = await Promise.all([
    pool.query<{
    users_count: string | number;
    admins_count: string | number;
    tickets_count: string | number;
    paid_tickets_count: string | number;
    transactions_count: string | number;
    paid_transactions_count: string | number;
    pending_transactions_count: string | number;
    failed_transactions_count: string | number;
    revenue_cents: string | number | null;
    users_today_count: string | number;
  }>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users_count,
         (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')) AS admins_count,
         (SELECT COUNT(*) FROM tickets) AS tickets_count,
         (SELECT COUNT(*) FROM tickets WHERE status = 'paid') AS paid_tickets_count,
         (SELECT COUNT(*) FROM transactions) AS transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('paid', 'approved')) AS paid_transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('pending_payment', 'pending', 'creating', 'waiting_payment')) AS pending_transactions_count,
         (SELECT COUNT(*) FROM transactions WHERE status IN ('failed', 'canceled', 'cancelled', 'refused', 'expired')) AS failed_transactions_count,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE status IN ('paid', 'approved')) AS revenue_cents,
         (SELECT COUNT(*) FROM users WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS users_today_count`
    ),
    pool.query<{
      day: Date;
      label: string;
      users_count: string | number;
      transactions_count: string | number;
      paid_transactions_count: string | number;
      revenue_cents: string | number | null;
    }>(
      `WITH days AS (
         SELECT generate_series(
           (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '13 days',
           (now() AT TIME ZONE 'America/Sao_Paulo')::date,
           interval '1 day'
         )::date AS day
       )
       SELECT
         days.day,
         to_char(days.day, 'DD/MM') AS label,
         COUNT(DISTINCT u.id) AS users_count,
         COUNT(DISTINCT tx.id) AS transactions_count,
         COUNT(DISTINCT tx.id) FILTER (WHERE tx.status IN ('paid', 'approved')) AS paid_transactions_count,
         COALESCE(SUM(tx.amount_cents) FILTER (WHERE tx.status IN ('paid', 'approved')), 0) AS revenue_cents
       FROM days
       LEFT JOIN users u ON u.created_at::date = days.day
       LEFT JOIN transactions tx ON tx.created_at::date = days.day
       GROUP BY days.day
       ORDER BY days.day ASC`
    ),
    pool.query<{ label: string; value: string | number }>(
      `SELECT ticket_type AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY ticket_type
       ORDER BY value DESC`
    ),
    pool.query<{ label: string; value: string | number }>(
      `SELECT status AS label, COUNT(*) AS value
       FROM transactions
       GROUP BY status
       ORDER BY value DESC`
    ),
    pool.query<{
      id: string;
      user_name: string | null;
      user_email: string;
      status: string;
      amount_cents: number;
      created_at: Date;
    }>(
      `SELECT
         tx.id,
         u.name AS user_name,
         u.email AS user_email,
         tx.status,
         tx.amount_cents,
         tx.created_at
       FROM transactions tx
       LEFT JOIN users u ON u.id::text = tx.user_id::text
       ORDER BY tx.created_at DESC
       LIMIT 6`
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
      value: Number(item.value ?? 0),
    })),
    transactionStatusBreakdown: statuses.rows.map((item) => ({
      label: item.label,
      value: Number(item.value ?? 0),
    })),
    recentTransactions: recentTransactions.rows.map((transaction) => ({
      id: transaction.id,
      userName: transaction.user_name,
      userEmail: transaction.user_email,
      status: transaction.status,
      amountCents: transaction.amount_cents,
      createdAt: transaction.created_at.toISOString(),
    })),
  };
}
