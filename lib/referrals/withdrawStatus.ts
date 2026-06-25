/** Status internos de affiliate_withdrawal_requests (Postgres + Cartwave). */
export const WITHDRAWAL_STATUSES = [
  "pending",
  "processing",
  "approved",
  "paid",
  "rejected",
  "failed",
  "refunded",
] as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

const TERMINAL: ReadonlySet<string> = new Set([
  "paid",
  "rejected",
  "failed",
  "refunded",
]);

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  processing: 1,
  approved: 2,
  paid: 3,
  rejected: 3,
  failed: 3,
  refunded: 4,
};

/** Cartwave: não regredir SUCCESS/ERROR/etc. para NEW por evento atrasado. */
const CARTWAVE_STATUS_RANK: Record<string, number> = {
  NEW: 1,
  PROCESSING: 2,
  SUCCESS: 10,
  ERROR: 10,
  CANCELLED: 10,
  REFUNDED: 10,
};

export function isTerminalWithdrawalStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function nextWithdrawalStatus(
  current: string,
  proposed: WithdrawalStatus,
): WithdrawalStatus {
  const cur = current as WithdrawalStatus;
  if (TERMINAL.has(cur)) return cur;
  const curRank = STATUS_RANK[cur] ?? 0;
  const nextRank = STATUS_RANK[proposed] ?? 0;
  return nextRank >= curRank ? proposed : cur;
}

export function nextCartwaveStatus(current: string | null | undefined, proposed: string): string {
  const cur = String(current ?? "").trim().toUpperCase();
  const next = proposed.trim().toUpperCase();
  if (!cur) return next;
  const curRank = CARTWAVE_STATUS_RANK[cur] ?? 5;
  const nextRank = CARTWAVE_STATUS_RANK[next] ?? 5;
  return nextRank >= curRank ? next : cur;
}
