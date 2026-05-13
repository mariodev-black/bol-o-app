import { unstable_cache } from "next/cache";
import { fetchMatchesMap } from "@/lib/football-api";
import {
  calcPredictionPoints,
  listMatchIdsForTicketPredictions,
  listPredictionsAggregateByBolao,
  type PredictionAggregateRow,
} from "@/lib/predictions";
import { getPool } from "@/lib/db";
import { resolveDiarioPlayableDate } from "@/lib/payments/user-tickets";
import { calculatePrizePoolCents } from "@/lib/prizes/distribution";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

export function avatarIndexFromDb(v: string | number | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return clampAvatarIndex(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return clampAvatarIndex(n);
  }
  return clampAvatarIndex(0);
}

type MatchMap = Awaited<ReturnType<typeof fetchMatchesMap>>;
type MatchInfo = NonNullable<ReturnType<MatchMap["get"]>>;

function isFinishedStatus(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

function kickoffMs(match: MatchInfo): number | null {
  if (match.kickoffAt) {
    const parsed = Date.parse(match.kickoffAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (!match.dateBR || !match.hour) return null;
  const [d, m, y] = match.dateBR.split("/");
  const [hh, mm] = match.hour.split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

function lockMs(match: MatchInfo): number | null {
  const kickoff = kickoffMs(match);
  return kickoff == null ? null : kickoff - 60 * 60 * 1000;
}

function brDateToUtcMs(dateBR: string): number | null {
  const [d, m, y] = String(dateBR || "").split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month - 1, day);
}

function minBrDate(dates: Iterable<string>): string {
  let best: string | null = null;
  let bestMs = Infinity;
  for (const d of dates) {
    const ms = brDateToUtcMs(d);
    if (ms != null && ms < bestMs) {
      bestMs = ms;
      best = d;
    }
  }
  return best ?? [...dates][0] ?? "";
}

type PaidTicketRow = {
  id: string;
  user_id: string;
  ticket_type: "general" | "daily";
  total_amount_cents: number;
};

const RANKING_REVALIDATE_SEC = Math.min(
  120,
  Math.max(5, Number.parseInt(process.env.RANKING_CACHE_SECONDS ?? "12", 10) || 12)
);

type AggRow = {
  ticketId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  firstSubmitAt: number;
  hitSequence: Array<{ order: number; hit: boolean }>;
};

function aggregatePredictions(
  predictions: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>
): Map<string, AggRow> {
  const byTicket = new Map<string, AggRow>();

  for (const prediction of predictions) {
    if (!allowedTicketIds.has(prediction.ticket_id)) continue;
    const matchId = Number(prediction.match_id);
    if (!Number.isFinite(matchId)) continue;
    const match = matches.get(matchId);
    if (!match || match.resultCasa == null || match.resultVisitante == null) continue;

    const cur =
      byTicket.get(prediction.ticket_id) ??
      {
        ticketId: prediction.ticket_id,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        bestStreak: 0,
        firstSubmitAt: new Date(prediction.submitted_at).getTime(),
        hitSequence: [],
      };

    const calc = calcPredictionPoints(
      prediction.score_casa,
      prediction.score_visitante,
      match.resultCasa,
      match.resultVisitante
    );
    cur.totalPoints += calc.points;
    cur.exactCount += calc.exact ? 1 : 0;
    cur.outcomeCount += calc.outcomeHit ? 1 : 0;
    cur.goalsCount += calc.goalsHitCount;
    cur.hitSequence.push({
      order: match.kickoffAt ? new Date(match.kickoffAt).getTime() : matchId,
      hit: calc.points > 0,
    });
    cur.firstSubmitAt = Math.min(cur.firstSubmitAt, new Date(prediction.submitted_at).getTime());
    byTicket.set(prediction.ticket_id, cur);
  }

  for (const row of byTicket.values()) {
    let current = 0;
    for (const item of row.hitSequence.sort((a, b) => a.order - b.order)) {
      if (item.hit) {
        current += 1;
        row.bestStreak = Math.max(row.bestStreak, current);
      } else {
        current = 0;
      }
    }
  }

  return byTicket;
}

function computeNextPalpiteLockMs(matches: MatchMap, matchFilter: (m: MatchInfo) => boolean, now = Date.now()): number | null {
  const locks: number[] = [];
  for (const m of matches.values()) {
    if (!matchFilter(m)) continue;
    if (isFinishedStatus(m.status)) continue;
    const lock = lockMs(m);
    if (lock != null && lock > now) locks.push(lock);
  }
  locks.sort((a, b) => a - b);
  return locks[0] ?? null;
}

/** Alguma partida em que há palpite no pool já tem resultado (placar) — ranking pode somar pontos. */
function poolHasAnyResultedMatch(
  poolPreds: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>
): boolean {
  const seen = new Set<number>();
  for (const p of poolPreds) {
    if (!allowedTicketIds.has(p.ticket_id)) continue;
    const mid = Number(p.match_id);
    if (!Number.isFinite(mid) || seen.has(mid)) continue;
    seen.add(mid);
    const m = matches.get(mid);
    if (m && m.resultCasa != null && m.resultVisitante != null) return true;
  }
  return false;
}

export type LeaderboardRow = {
  pos: number;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  avatarIndex: number;
  avatarUploadFilename: string | null;
};

export type LeaderboardBoardMeta = {
  participantCount: number;
  revenueCents: number;
  poolCentsApprox: number;
  nextPalpiteLockMs: number | null;
  approxPremiados: number;
  /** True se alguma partida do pool (palpites dos participantes) já tem placar oficial. */
  hasResultedMatchesInPool: boolean;
};

async function loadPaidTickets(ticketType: "general" | "daily"): Promise<PaidTicketRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    ticket_type: "general" | "daily";
    total_amount_cents: string | number | null;
  }>(
    `SELECT t.id::text AS id, t.user_id::text AS user_id, t.ticket_type,
            COALESCE(t.total_amount_cents, 0) AS total_amount_cents
     FROM tickets t
     WHERE t.status = 'paid' AND t.ticket_type = $1`,
    [ticketType]
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    ticket_type: r.ticket_type,
    total_amount_cents: Number(r.total_amount_cents ?? 0),
  }));
}

export async function buildLeaderboardPrincipal(): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const getCached = unstable_cache(
    async () => buildLeaderboardPrincipalUncached(),
    ["leaderboard", "principal", "v3"],
    { revalidate: RANKING_REVALIDATE_SEC, tags: ["leaderboard"] }
  );
  return getCached();
}

async function buildLeaderboardPrincipalUncached(): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const [matches, paidTickets, preds] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<number, MatchInfo>()),
    loadPaidTickets("general"),
    listPredictionsAggregateByBolao("principal"),
  ]);

  const ticketIdsWithPalpite = new Set(preds.map((p) => p.ticket_id));
  const paidInPool = paidTickets.filter((t) => ticketIdsWithPalpite.has(t.id));

  const allowed = new Set(paidInPool.map((t) => t.id));
  const agg = aggregatePredictions(preds, matches, allowed);

  const sortedTickets = paidInPool
    .map((t) => {
      const a = agg.get(t.id);
      return {
        ticketId: t.id,
        userId: t.user_id,
        totalPoints: a?.totalPoints ?? 0,
        exactCount: a?.exactCount ?? 0,
        outcomeCount: a?.outcomeCount ?? 0,
        goalsCount: a?.goalsCount ?? 0,
        bestStreak: a?.bestStreak ?? 0,
        firstSubmitAt: a?.firstSubmitAt ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((x, y) => {
      if (y.totalPoints !== x.totalPoints) return y.totalPoints - x.totalPoints;
      if (y.exactCount !== x.exactCount) return y.exactCount - x.exactCount;
      if (y.outcomeCount !== x.outcomeCount) return y.outcomeCount - x.outcomeCount;
      if (y.goalsCount !== x.goalsCount) return y.goalsCount - x.goalsCount;
      if (y.bestStreak !== x.bestStreak) return y.bestStreak - x.bestStreak;
      return x.firstSubmitAt - y.firstSubmitAt;
    });

  const userIds = [...new Set(sortedTickets.map((t) => t.userId))];
  const usersMap = await loadUsersMap(userIds);

  const rows: LeaderboardRow[] = sortedTickets.map((t, idx) => {
    const u = usersMap.get(t.userId);
    return {
      pos: idx + 1,
      ticketId: t.ticketId,
      userId: t.userId,
      displayName: displayNameFromUser(u),
      totalPoints: t.totalPoints,
      exactCount: t.exactCount,
      outcomeCount: t.outcomeCount,
      goalsCount: t.goalsCount,
      bestStreak: t.bestStreak,
      avatarIndex: avatarIndexFromDb(u?.avatar_index),
      avatarUploadFilename: safeUploadFilename(u?.avatar_upload_filename),
    };
  });

  const revenueCents = paidInPool.reduce((s, t) => s + t.total_amount_cents, 0);
  const participantCount = paidInPool.length;
  const poolCentsApprox = calculatePrizePoolCents(revenueCents);
  const nextPalpiteLockMs = computeNextPalpiteLockMs(matches, () => true);
  const approxPremiados = Math.max(1, Math.ceil(participantCount / 10));
  const hasResultedMatchesInPool = poolHasAnyResultedMatch(preds, matches, allowed);

  return {
    rows,
    meta: {
      participantCount,
      revenueCents,
      poolCentsApprox,
      nextPalpiteLockMs,
      approxPremiados,
      hasResultedMatchesInPool,
    },
  };
}

export async function buildLeaderboardDiarioForTicket(focusTicketId: string): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const getCached = unstable_cache(
    async () => buildLeaderboardDiarioUncached(focusTicketId),
    ["leaderboard", "diario", focusTicketId, "v3"],
    { revalidate: RANKING_REVALIDATE_SEC, tags: ["leaderboard"] }
  );
  return getCached();
}

async function buildLeaderboardDiarioUncached(focusTicketId: string): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const pool = getPool();
  const { rows: ticketCheck } = await pool.query<{ id: string; ticket_type: string }>(
    `SELECT id::text AS id, ticket_type::text AS ticket_type FROM tickets WHERE id = $1 AND status = 'paid' LIMIT 1`,
    [focusTicketId]
  );
  const ticketRow = ticketCheck[0];
  if (!ticketRow || ticketRow.ticket_type !== "daily") {
    return {
      rows: [],
      meta: {
        participantCount: 0,
        revenueCents: 0,
        poolCentsApprox: 0,
        nextPalpiteLockMs: null,
        approxPremiados: 0,
        hasResultedMatchesInPool: false,
      },
    };
  }

  const [matches, paidDaily, focusMatchIds, allDiario] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<number, MatchInfo>()),
    loadPaidTickets("daily"),
    listMatchIdsForTicketPredictions(focusTicketId),
    listPredictionsAggregateByBolao("diario"),
  ]);

  const datesFromFocus = new Set<string>();
  for (const mid of focusMatchIds) {
    const d = matches.get(mid)?.dateBR;
    if (d) datesFromFocus.add(d);
  }

  const playable = resolveDiarioPlayableDate(matches);
  let poolPlayDate: string;
  if (datesFromFocus.size === 1) {
    poolPlayDate = [...datesFromFocus][0]!;
  } else if (datesFromFocus.size > 1) {
    poolPlayDate = datesFromFocus.has(playable) ? playable : minBrDate(datesFromFocus);
  } else {
    poolPlayDate = playable;
  }

  const allowedDailyIds = new Set(paidDaily.map((t) => t.id));

  const cohortPreds = allDiario.filter((p) => {
    if (!allowedDailyIds.has(p.ticket_id)) return false;
    const d = matches.get(Number(p.match_id))?.dateBR;
    return d === poolPlayDate;
  });

  const agg = aggregatePredictions(cohortPreds, matches, allowedDailyIds);

  const ticketIdsInCohort = new Set(cohortPreds.map((p) => p.ticket_id));

  const sortedTickets = paidDaily
    .filter((t) => ticketIdsInCohort.has(t.id))
    .map((t) => {
      const a = agg.get(t.id);
      return {
        ticketId: t.id,
        userId: t.user_id,
        totalPoints: a?.totalPoints ?? 0,
        exactCount: a?.exactCount ?? 0,
        outcomeCount: a?.outcomeCount ?? 0,
        goalsCount: a?.goalsCount ?? 0,
        bestStreak: a?.bestStreak ?? 0,
        firstSubmitAt: a?.firstSubmitAt ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((x, y) => {
      if (y.totalPoints !== x.totalPoints) return y.totalPoints - x.totalPoints;
      if (y.exactCount !== x.exactCount) return y.exactCount - x.exactCount;
      if (y.outcomeCount !== x.outcomeCount) return y.outcomeCount - x.outcomeCount;
      if (y.goalsCount !== x.goalsCount) return y.goalsCount - x.goalsCount;
      if (y.bestStreak !== x.bestStreak) return y.bestStreak - x.bestStreak;
      return x.firstSubmitAt - y.firstSubmitAt;
    });

  const userIds = [...new Set(sortedTickets.map((t) => t.userId))];
  const usersMap = await loadUsersMap(userIds);

  const rows: LeaderboardRow[] = sortedTickets.map((t, idx) => {
    const u = usersMap.get(t.userId);
    return {
      pos: idx + 1,
      ticketId: t.ticketId,
      userId: t.userId,
      displayName: displayNameFromUser(u),
      totalPoints: t.totalPoints,
      exactCount: t.exactCount,
      outcomeCount: t.outcomeCount,
      goalsCount: t.goalsCount,
      bestStreak: t.bestStreak,
      avatarIndex: avatarIndexFromDb(u?.avatar_index),
      avatarUploadFilename: safeUploadFilename(u?.avatar_upload_filename),
    };
  });

  const cohortTicketIds = new Set(sortedTickets.map((t) => t.ticketId));
  const revenueCents = paidDaily.filter((t) => cohortTicketIds.has(t.id)).reduce((s, t) => s + t.total_amount_cents, 0);
  const participantCount = sortedTickets.length;
  const poolCentsApprox = calculatePrizePoolCents(revenueCents);

  const dateSet = new Set([poolPlayDate]);
  const nextPalpiteLockMs = computeNextPalpiteLockMs(matches, (m) => {
    if (!m.dateBR) return false;
    return dateSet.has(m.dateBR);
  });

  const approxPremiados = Math.max(1, Math.ceil(participantCount / 10));
  const hasResultedMatchesInPool = poolHasAnyResultedMatch(cohortPreds, matches, allowedDailyIds);

  return {
    rows,
    meta: {
      participantCount,
      revenueCents,
      poolCentsApprox,
      nextPalpiteLockMs,
      approxPremiados,
      hasResultedMatchesInPool,
    },
  };
}

type UserLite = {
  id: string;
  name: string | null;
  email: string;
  avatar_index: string | number | null;
  avatar_upload_filename: string | null;
};

function safeUploadFilename(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t && isStoredAvatarUploadFilename(t) ? t : null;
}

function displayNameFromUser(u: UserLite | undefined): string {
  if (!u) return "Jogador";
  const n = typeof u.name === "string" ? u.name.trim() : "";
  if (n) return n;
  const email = typeof u.email === "string" ? u.email.trim() : "";
  const local = email.split("@")[0] ?? "";
  return local || "Jogador";
}

async function loadUsersMap(userIds: string[]): Promise<Map<string, UserLite>> {
  const out = new Map<string, UserLite>();
  if (userIds.length === 0) return out;
  const pool = getPool();
  const { rows } = await pool.query<UserLite>(
    `SELECT id::text AS id, name, email, avatar_index, avatar_upload_filename
     FROM users
     WHERE id::text = ANY($1::text[])`,
    [userIds]
  );
  for (const r of rows) {
    out.set(r.id, r);
  }
  return out;
}
