import { unstable_cache } from "next/cache";
import { fetchMatchesMap, getMatchFromMap, matchMapKey } from "@/lib/football-api";
import {
  calcPredictionPoints,
  listMatchIdsForTicketPredictions,
  listPredictionsAggregateByBolao,
  listPredictionsAggregateByExtraCompetition,
  palpiteLockBeforeKickoffMs,
  type PredictionAggregateRow,
} from "@/lib/predictions";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { getPool } from "@/lib/db";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import {
  listMatchesForExtraRound,
  resolveCurrentExtraRound,
  resolveEffectiveExtraRoundForTicket,
} from "@/lib/football/extras-rodada";
import { calculatePrizePoolCents } from "@/lib/prizes/distribution";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { hasOfficialMatchResult, isLiveOrInProgressMatchStatus } from "@/lib/palpites-match-open";
import { isRankingFillerRow } from "@/lib/ranking/ranking-bots";
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

function lockMs(match: MatchInfo, leadMs: number): number | null {
  const kickoff = kickoffMs(match);
  return kickoff == null ? null : kickoff - leadMs;
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

/** Datas de jogos em que cada cota tem palpite (por campeonato). */
function buildTicketPlayDatesByCompetition(
  predictions: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>,
  competitionId: number,
): Map<string, Set<string>> {
  const ticketDates = new Map<string, Set<string>>();
  for (const p of predictions) {
    if (!allowedTicketIds.has(p.ticket_id)) continue;
    const mi = getMatchFromMap(matches, competitionId, Number(p.match_id));
    if (!mi || Number(mi.competitionId) !== competitionId) continue;
    const date = mi.dateBR;
    if (!date) continue;
    let set = ticketDates.get(p.ticket_id);
    if (!set) {
      set = new Set();
      ticketDates.set(p.ticket_id, set);
    }
    set.add(date);
  }
  return ticketDates;
}

/** Cota entra no pool do dia: sem palpite ainda ou pelo menos um palpite nesta data. */
function ticketEligibleForPlayDate(
  ticketId: string,
  poolPlayDate: string,
  ticketPlayDates: Map<string, Set<string>>,
): boolean {
  const dates = ticketPlayDates.get(ticketId);
  if (!dates || dates.size === 0) return true;
  return dates.has(poolPlayDate);
}

/** Primeira rodada com palpite (por `submitted_at`), igual ao admin (`first_ticket_rodada`). */
function buildTicketFirstPlayRoundByCompetition(
  predictions: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>,
  competitionId: number,
): Map<string, number> {
  const first = new Map<string, { rodada: number; at: number }>();
  for (const p of predictions) {
    if (!allowedTicketIds.has(p.ticket_id)) continue;
    const mi = getMatchFromMap(matches, competitionId, Number(p.match_id));
    if (!mi || Number(mi.competitionId) !== competitionId) continue;
    const rodada = mi.rodada;
    if (rodada == null || !Number.isFinite(rodada) || rodada <= 0) continue;
    const at = new Date(p.submitted_at).getTime();
    if (!Number.isFinite(at)) continue;
    const cur = first.get(p.ticket_id);
    if (!cur || at < cur.at) first.set(p.ticket_id, { rodada, at });
  }
  const out = new Map<string, number>();
  for (const [ticketId, v] of first) out.set(ticketId, v.rodada);
  return out;
}

async function resolveEffectiveRodadaCached(
  competitionId: number,
  roundNumber: number,
  cache: Map<string, number>,
): Promise<number> {
  const key = `${competitionId}:${roundNumber}`;
  const hit = cache.get(key);
  if (hit != null) return hit;
  const effective = await resolveEffectiveExtraRoundForTicket(competitionId, roundNumber, {
    allowProviderCall: false,
  });
  const rodada = effective?.rodada ?? roundNumber;
  cache.set(key, rodada);
  return rodada;
}

/** Rodada do bolão extra da cota: `tickets.round_number` ou 1º palpite (como no admin). */
async function buildAssignedExtraRodadaByTicket(
  tickets: PaidTicketRow[],
  firstPlayRound: Map<string, number>,
  competitionId: number,
): Promise<Map<string, number | null>> {
  const effectiveCache = new Map<string, number>();
  const out = new Map<string, number | null>();
  for (const t of tickets) {
    const rn = t.round_number;
    if (rn != null && Number.isFinite(rn) && rn > 0) {
      out.set(t.id, await resolveEffectiveRodadaCached(competitionId, rn, effectiveCache));
      continue;
    }
    const fromPred = firstPlayRound.get(t.id);
    out.set(t.id, fromPred != null && fromPred > 0 ? fromPred : null);
  }
  return out;
}

function ticketEligibleForExtraPool(
  ticketId: string,
  poolRodada: number,
  assignedRodadaByTicket: Map<string, number | null>,
  currentRodada: number | null,
): boolean {
  const assigned = assignedRodadaByTicket.get(ticketId);
  if (assigned != null) return assigned === poolRodada;
  return currentRodada != null && currentRodada === poolRodada;
}

function matchInExtraPool(
  mi: MatchInfo | undefined,
  poolRodada: number | null,
  poolPlayDate: string,
): boolean {
  if (!mi) return false;
  if (poolRodada != null && mi.rodada != null && mi.rodada > 0) {
    return mi.rodada === poolRodada;
  }
  return mi.dateBR === poolPlayDate;
}

async function resolveExtraPoolRodadaForFocus(
  focusTicketId: string,
  extraComp: number,
  paidExtra: PaidTicketRow[],
  allExtra: PredictionAggregateRow[],
  matches: MatchMap,
): Promise<{ poolRodada: number | null; currentRodada: number | null; assignedRodadaByTicket: Map<string, number | null> }> {
  const allowedExtraIds = new Set(paidExtra.map((t) => t.id));
  const firstPlayRound = buildTicketFirstPlayRoundByCompetition(
    allExtra,
    matches,
    allowedExtraIds,
    extraComp,
  );
  const assignedRodadaByTicket = await buildAssignedExtraRodadaByTicket(
    paidExtra,
    firstPlayRound,
    extraComp,
  );
  const current = await resolveCurrentExtraRound(extraComp, { allowProviderCall: false });
  const currentRodada = current?.rodada ?? null;
  const fromFocus = assignedRodadaByTicket.get(focusTicketId);
  const poolRodada = fromFocus ?? currentRodada;
  return { poolRodada, currentRodada, assignedRodadaByTicket };
}

type PaidTicketRow = {
  id: string;
  user_id: string;
  ticket_type: "general" | "daily" | "extra";
  total_amount_cents: number;
  unit_price_cents?: number;
  quantity?: number;
  extra_championship_id?: number | null;
  round_number?: number | null;
  is_promo_bonus?: boolean;
};

function paidTicketRevenueCents(t: PaidTicketRow): number {
  if (t.is_promo_bonus) return 0;
  const total = Number(t.total_amount_cents ?? 0);
  if (total > 0) return total;
  const unit = Number(t.unit_price_cents ?? 0);
  const qty = Number(t.quantity ?? 1);
  return unit > 0 && qty > 0 ? unit * qty : 0;
}

type LoadPaidTicketsOpts = {
  /** Cotas grátis (brinde) entram no ranking extra, mas não na receita do prêmio. */
  includePromoBonus?: boolean;
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
  allowedTicketIds: Set<string>,
  competitionId: number
): Map<string, AggRow> {
  const byTicket = new Map<string, AggRow>();

  for (const prediction of predictions) {
    if (!allowedTicketIds.has(prediction.ticket_id)) continue;
    const matchId = Number(prediction.match_id);
    if (!Number.isFinite(matchId)) continue;
    const match = getMatchFromMap(matches, competitionId, matchId);
    const submitMs = new Date(prediction.submitted_at).getTime();
    if (!Number.isFinite(submitMs)) continue;

    const cur =
      byTicket.get(prediction.ticket_id) ??
      {
        ticketId: prediction.ticket_id,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        bestStreak: 0,
        firstSubmitAt: submitMs,
        hitSequence: [],
      };

    cur.firstSubmitAt = Math.min(cur.firstSubmitAt, submitMs);

    if (match != null) {
      const rc = match.resultCasa;
      const rv = match.resultVisitante;
      if (rc != null && rv != null) {
        const calc = calcPredictionPoints(prediction.score_casa, prediction.score_visitante, rc, rv);
        cur.totalPoints += calc.points;
        cur.exactCount += calc.exact ? 1 : 0;
        cur.outcomeCount += calc.outcomeHit ? 1 : 0;
        cur.goalsCount += calc.goalsHitCount;
        cur.hitSequence.push({
          order: match.kickoffAt ? new Date(match.kickoffAt).getTime() : matchId,
          hit: calc.points > 0,
        });
      }
    }

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

function computeNextPalpiteLockMs(
  matches: MatchMap,
  matchFilter: (m: MatchInfo) => boolean,
  lockLeadMs: number,
  now = Date.now()
): number | null {
  const locks: number[] = [];
  for (const m of matches.values()) {
    if (!matchFilter(m)) continue;
    if (isFinishedStatus(m.status)) continue;
    const lock = lockMs(m, lockLeadMs);
    if (lock != null && lock > now) locks.push(lock);
  }
  locks.sort((a, b) => a - b);
  return locks[0] ?? null;
}

function poolMatchesForPreds(
  poolPreds: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>,
  competitionId: number,
): MatchInfo[] {
  const seen = new Set<string>();
  const out: MatchInfo[] = [];
  for (const p of poolPreds) {
    if (!allowedTicketIds.has(p.ticket_id)) continue;
    const mid = Number(p.match_id);
    if (!Number.isFinite(mid)) continue;
    const key = matchMapKey(competitionId, mid);
    if (seen.has(key)) continue;
    seen.add(key);
    const m = getMatchFromMap(matches, competitionId, mid);
    if (m) out.push(m);
  }
  return out;
}

/** Placar disponível — ranking soma pontos. */
function poolHasAnyResultedMatch(
  poolPreds: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>,
  competitionId: number,
): boolean {
  return poolMatchesForPreds(poolPreds, matches, allowedTicketIds, competitionId).some(
    (m) =>
      hasOfficialMatchResult({
        status: m.status,
        kickoffAt: m.kickoffAt,
        resultCasa: m.resultCasa,
        resultVisitante: m.resultVisitante,
      }),
  );
}

function poolHasLiveMatch(
  poolPreds: PredictionAggregateRow[],
  matches: MatchMap,
  allowedTicketIds: Set<string>,
  competitionId: number,
  now = Date.now(),
): boolean {
  for (const m of poolMatchesForPreds(
    poolPreds,
    matches,
    allowedTicketIds,
    competitionId,
  )) {
    if (isLiveOrInProgressMatchStatus(String(m.status ?? ""))) return true;
    if (
      hasOfficialMatchResult(
        {
          status: m.status,
          kickoffAt: m.kickoffAt,
          resultCasa: m.resultCasa,
          resultVisitante: m.resultVisitante,
        },
        now,
      )
    ) {
      continue;
    }
    const kickoff = m.kickoffAt ? new Date(m.kickoffAt).getTime() : NaN;
    if (Number.isFinite(kickoff) && kickoff <= now && !isFinishedStatus(m.status)) {
      return true;
    }
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
  isFiller?: boolean;
};

export type LeaderboardBoardMeta = {
  participantCount: number;
  revenueCents: number;
  poolCentsApprox: number;
  nextPalpiteLockMs: number | null;
  approxPremiados: number;
  /** True se alguma partida do pool (palpites dos participantes) já tem placar oficial. */
  hasResultedMatchesInPool: boolean;
  hasLiveMatchesInPool?: boolean;
};

function countMatchesInPool(
  matches: MatchMap,
  filter: (m: MatchInfo) => boolean,
): number {
  let n = 0;
  for (const m of matches.values()) {
    if (filter(m)) n += 1;
  }
  return Math.max(1, n);
}

function poolMatchScoringProgress(
  matches: MatchMap,
  filter: (m: MatchInfo) => boolean,
  now = Date.now(),
): { total: number; finished: number; live: number } {
  let total = 0;
  let finished = 0;
  let live = 0;
  for (const m of matches.values()) {
    if (!filter(m)) continue;
    total += 1;
    const hasScore = hasOfficialMatchResult(
      {
        status: m.status,
        kickoffAt: m.kickoffAt,
        resultCasa: m.resultCasa,
        resultVisitante: m.resultVisitante,
      },
      now,
    );
    if (isFinishedStatus(m.status) && hasScore) {
      finished += 1;
      continue;
    }
    if (isLiveOrInProgressMatchStatus(String(m.status ?? ""))) {
      live += 1;
      continue;
    }
    if (hasScore) {
      live += 1;
      continue;
    }
    const kickoff = m.kickoffAt ? new Date(m.kickoffAt).getTime() : NaN;
    if (Number.isFinite(kickoff) && kickoff <= now && !isFinishedStatus(m.status)) {
      live += 1;
    }
  }
  return { total: Math.max(1, total), finished, live };
}

function compareLeaderboardRows(a: LeaderboardRow, b: LeaderboardRow): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
  if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
  if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
  if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
  const aFiller = isRankingFillerRow(a);
  const bFiller = isRankingFillerRow(b);
  if (aFiller !== bFiller) return aFiller ? 1 : -1;
  return a.ticketId.localeCompare(b.ticketId);
}

function finalizeLeaderboardDisplay(
  rows: LeaderboardRow[],
  meta: LeaderboardBoardMeta,
): { rows: LeaderboardRow[]; meta: LeaderboardBoardMeta } {
  const realOnly = rows
    .filter((r) => !isRankingFillerRow(r))
    .map((r) => ({ ...r, isFiller: false as const }));
  const sorted = [...realOnly].sort(compareLeaderboardRows);
  return {
    rows: sorted.map((r, idx) => ({ ...r, pos: idx + 1 })),
    meta,
  };
}

async function loadPaidTickets(
  ticketType: "general" | "daily" | "extra",
  extraChampionshipId?: number,
  opts?: LoadPaidTicketsOpts,
): Promise<PaidTicketRow[]> {
  const pool = getPool();
  const includePromo = opts?.includePromoBonus === true;
  if (ticketType === "extra" && extraChampionshipId != null) {
    const { rows } = await pool.query<{
      id: string;
      user_id: string;
      ticket_type: "extra";
      extra_championship_id: number | null;
      round_number: number | null;
      is_promo_bonus: boolean;
      total_amount_cents: string | number | null;
      unit_price_cents: string | number | null;
      quantity: string | number | null;
    }>(
      `SELECT t.id::text AS id, t.user_id::text AS user_id, t.ticket_type,
              t.extra_championship_id, t.round_number,
              COALESCE(t.is_promo_bonus, false) AS is_promo_bonus,
              COALESCE(t.total_amount_cents, 0) AS total_amount_cents,
              COALESCE(t.unit_price_cents, 0) AS unit_price_cents,
              COALESCE(t.quantity, 1) AS quantity
       FROM tickets t
       WHERE t.status IN ('paid', 'approved')
         AND t.ticket_type = 'extra'
         AND t.extra_championship_id = $1
         AND ($2::boolean OR NOT COALESCE(t.is_promo_bonus, false))`,
      [extraChampionshipId, includePromo],
    );
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      ticket_type: r.ticket_type,
      extra_championship_id: r.extra_championship_id,
      round_number: r.round_number,
      is_promo_bonus: Boolean(r.is_promo_bonus),
      total_amount_cents: Number(r.total_amount_cents ?? 0),
      unit_price_cents: Number(r.unit_price_cents ?? 0),
      quantity: Number(r.quantity ?? 1),
    }));
  }
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    ticket_type: "general" | "daily";
    total_amount_cents: string | number | null;
  }>(
    `SELECT t.id::text AS id, t.user_id::text AS user_id, t.ticket_type,
            COALESCE(t.total_amount_cents, 0) AS total_amount_cents
     FROM tickets t
     WHERE t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)
       AND t.ticket_type = $1`,
    [ticketType]
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    ticket_type: r.ticket_type,
    total_amount_cents: Number(r.total_amount_cents ?? 0),
    is_promo_bonus: false,
  }));
}

export async function buildLeaderboardPrincipal(): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const getCached = unstable_cache(
    async () => buildLeaderboardPrincipalUncached(),
    ["leaderboard", "principal", "v21-real-only"],
    { revalidate: RANKING_REVALIDATE_SEC, tags: ["leaderboard"] }
  );
  return getCached();
}

async function buildLeaderboardPrincipalUncached(): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const mainComp = getFootballMainCompetitionId();
  const [matches, paidTickets, preds] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<string, MatchInfo>()),
    loadPaidTickets("general"),
    listPredictionsAggregateByBolao("principal"),
  ]);

  const paidInPool = paidTickets;

  const allowed = new Set(paidInPool.map((t) => t.id));
  const agg = aggregatePredictions(preds, matches, allowed, mainComp);

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
  const nextPalpiteLockMs = computeNextPalpiteLockMs(matches, () => true, palpiteLockBeforeKickoffMs("principal"));
  const approxPremiados = Math.max(1, Math.ceil(participantCount / 10));
  const hasResultedMatchesInPool = poolHasAnyResultedMatch(preds, matches, allowed, mainComp);
  const hasLiveMatchesInPool = poolHasLiveMatch(preds, matches, allowed, mainComp);

  const meta: LeaderboardBoardMeta = {
    participantCount,
    revenueCents,
    poolCentsApprox,
    nextPalpiteLockMs,
    approxPremiados,
    hasResultedMatchesInPool,
    hasLiveMatchesInPool,
  };

  return finalizeLeaderboardDisplay(rows, meta);
}

export async function buildLeaderboardDiarioForTicket(focusTicketId: string): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const getCached = unstable_cache(
    async () => buildLeaderboardDiarioUncached(focusTicketId),
    ["leaderboard", "diario", focusTicketId, "v21-real-only"],
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

  const mainComp = getFootballMainCompetitionId();

  const [matches, paidDaily, focusMatchIds, allDiario] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<string, MatchInfo>()),
    loadPaidTickets("daily"),
    listMatchIdsForTicketPredictions(focusTicketId),
    listPredictionsAggregateByBolao("diario"),
  ]);

  const datesFromFocus = new Set<string>();
  for (const mid of focusMatchIds) {
    const d = getMatchFromMap(matches, mainComp, mid)?.dateBR;
    if (d) datesFromFocus.add(d);
  }

  const playable = resolveDiarioPlayableDate(matches, { competitionId: mainComp });
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
    const mi = getMatchFromMap(matches, mainComp, Number(p.match_id));
    if (!mi || Number(mi.competitionId) !== mainComp) return false;
    return mi.dateBR === poolPlayDate;
  });

  const agg = aggregatePredictions(cohortPreds, matches, allowedDailyIds, mainComp);

  const ticketPlayDates = buildTicketPlayDatesByCompetition(
    allDiario,
    matches,
    allowedDailyIds,
    mainComp,
  );

  const sortedTickets = paidDaily
    .filter((t) => ticketEligibleForPlayDate(t.id, poolPlayDate, ticketPlayDates))
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
    if (Number(m.competitionId) !== mainComp) return false;
    return dateSet.has(m.dateBR);
  }, palpiteLockBeforeKickoffMs("diario"));

  const approxPremiados = Math.max(1, Math.ceil(participantCount / 10));
  const hasResultedMatchesInPool = poolHasAnyResultedMatch(cohortPreds, matches, allowedDailyIds, mainComp);
  const hasLiveMatchesInPool = poolHasLiveMatch(
    cohortPreds,
    matches,
    allowedDailyIds,
    mainComp,
  );

  const meta: LeaderboardBoardMeta = {
    participantCount,
    revenueCents,
    poolCentsApprox,
    nextPalpiteLockMs,
    approxPremiados,
    hasResultedMatchesInPool,
    hasLiveMatchesInPool,
  };

  return finalizeLeaderboardDisplay(rows, meta);
}

export async function buildLeaderboardExtraForTicket(
  focusTicketId: string
): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const pool = getPool();
  const { rows: ticketCheck } = await pool.query<{
    id: string;
    ticket_type: string;
    extra_championship_id: number | null;
  }>(
    `SELECT id::text AS id, ticket_type::text AS ticket_type, extra_championship_id
     FROM tickets WHERE id = $1 AND status IN ('paid', 'approved') LIMIT 1`,
    [focusTicketId],
  );
  const ticketRow = ticketCheck[0];
  if (!ticketRow || ticketRow.ticket_type !== "extra" || ticketRow.extra_championship_id == null) {
    return { rows: [], meta: emptyMetaForExtra() };
  }
  const extraComp = Number(ticketRow.extra_championship_id);

  const [matches, paidExtra, allExtra] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<string, MatchInfo>()),
    loadPaidTickets("extra", extraComp, { includePromoBonus: true }),
    listPredictionsAggregateByBolao("extra"),
  ]);

  const { poolRodada } = await resolveExtraPoolRodadaForFocus(
    focusTicketId,
    extraComp,
    paidExtra,
    allExtra,
    matches,
  );
  if (poolRodada == null || poolRodada <= 0) {
    return { rows: [], meta: emptyMetaForExtra() };
  }

  const getCached = unstable_cache(
    async () => buildLeaderboardExtraForCompRoundUncached(extraComp, poolRodada),
    ["leaderboard", "extra", String(extraComp), String(poolRodada), "v21-real-only"],
    { revalidate: RANKING_REVALIDATE_SEC, tags: ["leaderboard"] },
  );
  return getCached();
}

function emptyMetaForExtra(): LeaderboardBoardMeta {
  return {
    participantCount: 0,
    revenueCents: 0,
    poolCentsApprox: 0,
    nextPalpiteLockMs: null,
    approxPremiados: 0,
    hasResultedMatchesInPool: false,
  };
}

async function buildLeaderboardExtraForCompRoundUncached(
  extraComp: number,
  poolRodada: number,
): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  if (extraComp <= 0 || poolRodada <= 0) {
    return { rows: [], meta: emptyMetaForExtra() };
  }

  const [matches, paidExtra, allExtra, roundMatches] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<string, MatchInfo>()),
    loadPaidTickets("extra", extraComp, { includePromoBonus: true }),
    listPredictionsAggregateByExtraCompetition(extraComp),
    listMatchesForExtraRound(extraComp, poolRodada),
  ]);

  const allowedExtraIds = new Set(paidExtra.map((t) => t.id));
  const roundMatchIds = new Set(roundMatches.map((m) => m.match_id));
  const firstPlayRound = buildTicketFirstPlayRoundByCompetition(
    allExtra,
    matches,
    allowedExtraIds,
    extraComp,
  );
  const assignedRodadaByTicket = await buildAssignedExtraRodadaByTicket(
    paidExtra,
    firstPlayRound,
    extraComp,
  );
  const currentRodadaResolved =
    (await resolveCurrentExtraRound(extraComp, { allowProviderCall: false }))?.rodada ?? null;

  const playable = resolveDiarioPlayableDate(matches, { competitionId: extraComp });
  let poolPlayDate = playable;
  const roundDates = new Set(
    roundMatches.map((m) => m.date_br).filter((d): d is string => Boolean(d?.trim())),
  );
  if (roundDates.size > 0) {
    poolPlayDate = [...roundDates].sort()[0]!;
  } else {
    for (const m of matches.values()) {
      if (Number(m.competitionId) === extraComp && m.rodada === poolRodada && m.dateBR) {
        poolPlayDate = m.dateBR;
        break;
      }
    }
  }

  const cohortPreds = allExtra.filter((p) => {
    if (!allowedExtraIds.has(p.ticket_id)) return false;
    const mid = Number(p.match_id);
    if (roundMatchIds.size > 0) {
      return roundMatchIds.has(mid);
    }
    const mi = getMatchFromMap(matches, extraComp, mid);
    if (!mi || Number(mi.competitionId) !== extraComp) return false;
    return matchInExtraPool(mi, poolRodada, poolPlayDate);
  });

  const agg = aggregatePredictions(cohortPreds, matches, allowedExtraIds, extraComp);

  const sortedTickets = paidExtra
    .filter((t) =>
      ticketEligibleForExtraPool(
        t.id,
        poolRodada,
        assignedRodadaByTicket,
        currentRodadaResolved,
      ),
    )
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
  const revenueCents = paidExtra
    .filter((t) => cohortTicketIds.has(t.id))
    .reduce((s, t) => s + paidTicketRevenueCents(t), 0);
  const participantCount = sortedTickets.length;
  const poolCentsApprox = calculatePrizePoolCents(revenueCents);

  const dateSet = new Set([poolPlayDate]);
  const nextPalpiteLockMs = computeNextPalpiteLockMs(matches, (m) => {
    if (!m.dateBR) return false;
    if (Number(m.competitionId) !== extraComp) return false;
    return dateSet.has(m.dateBR);
  }, palpiteLockBeforeKickoffMs("extra"));

  const approxPremiados = Math.max(1, Math.ceil(participantCount / 10));
  const hasResultedMatchesInPool = poolHasAnyResultedMatch(cohortPreds, matches, allowedExtraIds, extraComp);
  const hasLiveMatchesInPool = poolHasLiveMatch(
    cohortPreds,
    matches,
    allowedExtraIds,
    extraComp,
  );

  const meta: LeaderboardBoardMeta = {
    participantCount,
    revenueCents,
    poolCentsApprox,
    nextPalpiteLockMs,
    approxPremiados,
    hasResultedMatchesInPool,
    hasLiveMatchesInPool,
  };

  return finalizeLeaderboardDisplay(rows, meta);
}

/** Ranking completo de um bolão extra fixo (campeonato + rodada) — scripts/admin. */
export async function buildLeaderboardExtraForCompAndRound(
  extraComp: number,
  poolRodada: number,
): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  return buildLeaderboardExtraForCompRoundUncached(extraComp, poolRodada);
}

/** Para scripts de debug (fora do Next.js). */
export async function buildLeaderboardExtraForTicketDebug(
  focusTicketId: string,
): Promise<{ rows: LeaderboardRow[]; meta: LeaderboardBoardMeta }> {
  const pool = getPool();
  const { rows: ticketCheck } = await pool.query<{
    ticket_type: string;
    extra_championship_id: number | null;
  }>(
    `SELECT ticket_type::text AS ticket_type, extra_championship_id
     FROM tickets WHERE id = $1 AND status IN ('paid', 'approved') LIMIT 1`,
    [focusTicketId],
  );
  const ticketRow = ticketCheck[0];
  if (!ticketRow || ticketRow.ticket_type !== "extra" || ticketRow.extra_championship_id == null) {
    return { rows: [], meta: emptyMetaForExtra() };
  }
  const extraComp = Number(ticketRow.extra_championship_id);
  const [matches, paidExtra, allExtra] = await Promise.all([
    fetchMatchesMap().catch(() => new Map<string, MatchInfo>()),
    loadPaidTickets("extra", extraComp, { includePromoBonus: true }),
    listPredictionsAggregateByBolao("extra"),
  ]);
  const { poolRodada } = await resolveExtraPoolRodadaForFocus(
    focusTicketId,
    extraComp,
    paidExtra,
    allExtra,
    matches,
  );
  if (poolRodada == null || poolRodada <= 0) {
    return { rows: [], meta: emptyMetaForExtra() };
  }
  return buildLeaderboardExtraForCompRoundUncached(extraComp, poolRodada);
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
