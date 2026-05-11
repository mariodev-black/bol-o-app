
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listPaidTicketsForUser, type PaidTicketRow } from "@/lib/payments/user-tickets";
import { getTicketPriceCents } from "@/lib/payments/ticket-config";
import { calcPredictionPoints, listPredictions, type PredictionRow } from "@/lib/predictions";
import { fetchMatchesMap } from "@/lib/football-api";
import { getPool } from "@/lib/db";
import { BoloesClient, type BoloesScreenData } from "@/app/(authenticated)/boloes/BoloesClient";

export const dynamic = "force-dynamic";

type MatchMap = Awaited<ReturnType<typeof fetchMatchesMap>>;
type MatchInfo = MatchMap extends Map<number, infer T> ? T : never;

type TicketMetrics = {
  sent: number;
  total: number;
  progress: number;
  available: number;
  position: number | null;
  points: number;
};

type ActiveDailyStatus = NonNullable<BoloesScreenData["active"]["diario"]>["status"];

function debugBoloes(label: string, payload: unknown) {
  console.error(`[boloes/debug] ${label}`, JSON.stringify(payload, null, 2));
}

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

function brDateToUtcMs(dateBR: string): number | null {
  const [d, m, y] = String(dateBR || "").split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (![day, month, year].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day);
}

function todayBR(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
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

function isOpenMatch(match: MatchInfo, now = Date.now()): boolean {
  if (isFinishedStatus(match.status)) return false;
  const lock = lockMs(match);
  if (lock != null) return lock > now;
  const matchDate = brDateToUtcMs(match.dateBR);
  const today = brDateToUtcMs(todayBR());
  return matchDate != null && today != null && matchDate >= today;
}

function resolvePlayableDate(matches: MatchMap): string {
  const today = todayBR();
  const todayMs = brDateToUtcMs(today);
  const dates = Array.from(new Set(Array.from(matches.values()).map((m) => m.dateBR).filter(Boolean)));
  if (dates.includes(today)) return today;
  const future = dates
    .map((date) => ({ date, ms: brDateToUtcMs(date) }))
    .filter((item): item is { date: string; ms: number } => item.ms != null && todayMs != null && item.ms >= todayMs)
    .sort((a, b) => a.ms - b.ms);
  return future[0]?.date ?? today;
}

function nextLockMs(matches: MatchInfo[], now = Date.now()): number | null {
  const locks = matches
    .map(lockMs)
    .filter((value): value is number => value != null && value > now)
    .sort((a, b) => a - b);
  return locks[0] ?? null;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function shortTicketId(id: string): string {
  const clean = id.trim();
  if (!clean) return "------";
  return clean.slice(0, 6).toUpperCase();
}

function totalMatchesForTicket(ticket: PaidTicketRow, matches: MatchMap): number {
  if (ticket.ticketType === "daily") {
    const date = ticket.playDate || resolvePlayableDate(matches);
    return Array.from(matches.values()).filter((match) => match.dateBR === date && !isFinishedStatus(match.status)).length;
  }
  return Array.from(matches.values()).filter((match) => !isFinishedStatus(match.status)).length;
}

function buildRankingMap(predictions: PredictionRow[], matches: MatchMap): Map<string, { pos: number; points: number }> {
  const byTicket = new Map<string, {
    ticketId: string;
    totalPoints: number;
    exactCount: number;
    outcomeCount: number;
    goalsCount: number;
    bestStreak: number;
    firstSubmitAt: number;
    hitSequence: Array<{ order: number; hit: boolean }>;
  }>();

  for (const prediction of predictions) {
    const matchId = Number(prediction.match_id);
    if (!Number.isFinite(matchId)) continue;
    const match = matches.get(matchId);
    if (!match || match.resultCasa == null || match.resultVisitante == null) continue;

    const current = byTicket.get(prediction.ticket_id) ?? {
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
    current.totalPoints += calc.points;
    current.exactCount += calc.exact ? 1 : 0;
    current.outcomeCount += calc.outcomeHit ? 1 : 0;
    current.goalsCount += calc.goalsHitCount;
    current.hitSequence.push({
      order: match.kickoffAt ? new Date(match.kickoffAt).getTime() : matchId,
      hit: calc.points > 0,
    });
    current.firstSubmitAt = Math.min(current.firstSubmitAt, new Date(prediction.submitted_at).getTime());
    byTicket.set(prediction.ticket_id, current);
  }

  const rows = Array.from(byTicket.values()).map((row) => {
    let current = 0;
    for (const item of row.hitSequence.sort((a, b) => a.order - b.order)) {
      if (item.hit) {
        current += 1;
        row.bestStreak = Math.max(row.bestStreak, current);
      } else {
        current = 0;
      }
    }
    return row;
  }).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
    if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.firstSubmitAt - b.firstSubmitAt;
  });

  return new Map(rows.map((row, index) => [row.ticketId, { pos: index + 1, points: row.totalPoints }]));
}

async function listAllPredictions(): Promise<PredictionRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(`SELECT * FROM predictions ORDER BY submitted_at ASC`);
  return rows;
}

async function loadBoloesData(userId: string): Promise<BoloesScreenData> {
  const [tickets, matches, userPredictions, allPredictions] = await Promise.all([
    listPaidTicketsForUser(userId),
    fetchMatchesMap().catch(() => new Map()),
    listPredictions({ userId }).catch(() => []),
    listAllPredictions().catch(() => []),
  ]);

  debugBoloes("load:start", {
    userId,
    ticketsCount: tickets.length,
    matchesCount: matches.size,
    userPredictionsCount: userPredictions.length,
    allPredictionsCount: allPredictions.length,
  });
  debugBoloes(
    "tickets",
    tickets.map((ticket) => ({
      id: ticket.id,
      ticketType: ticket.ticketType,
      quantity: ticket.quantity,
      status: "paid",
      paidAt: ticket.paidAt,
      createdAt: ticket.createdAt,
      dailyStatus: ticket.dailyStatus,
      playDate: ticket.playDate,
      availableGames: ticket.availableGames,
    }))
  );

  const ranking = buildRankingMap(allPredictions, matches);
  const predictionsByTicket = new Map<string, PredictionRow[]>();
  for (const prediction of userPredictions) {
    const arr = predictionsByTicket.get(prediction.ticket_id) ?? [];
    arr.push(prediction);
    predictionsByTicket.set(prediction.ticket_id, arr);
  }

  const metricsByTicket = new Map<string, TicketMetrics>();
  for (const ticket of tickets) {
    const sent = predictionsByTicket.get(ticket.id)?.length ?? 0;
    const available = Math.max(0, Number(ticket.availableGames ?? 0));
    const total = Math.max(sent + available, totalMatchesForTicket(ticket, matches), sent);
    const ranked = ranking.get(ticket.id) ?? null;
    metricsByTicket.set(ticket.id, {
      sent,
      total,
      available,
      progress: total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0,
      position: ranked?.pos ?? null,
      points: ranked?.points ?? 0,
    });
  }

  debugBoloes(
    "metricsByTicket",
    tickets.map((ticket) => ({
      id: ticket.id,
      ticketType: ticket.ticketType,
      metrics: metricsByTicket.get(ticket.id) ?? null,
      userPredictions: predictionsByTicket.get(ticket.id)?.length ?? 0,
      ranking: ranking.get(ticket.id) ?? null,
    }))
  );

  const firstGeneral = tickets.find((ticket) => ticket.ticketType === "general") ?? null;
  const firstDaily = tickets.find((ticket) => ticket.ticketType === "daily") ?? null;
  const playableDate = resolvePlayableDate(matches);
  const playableDateMatches = Array.from(matches.values()).filter((match) => match.dateBR === playableDate && isOpenMatch(match));
  const dailyMatchesCount = playableDateMatches.length;
  const dailyCloseAtMs = nextLockMs(playableDateMatches);
  const generalOpenMatches = Array.from(matches.values()).filter((match) => isOpenMatch(match));
  const generalCloseAtMs = nextLockMs(generalOpenMatches);
  const positions = tickets
    .map((ticket) => metricsByTicket.get(ticket.id)?.position ?? null)
    .filter((pos): pos is number => pos != null);
  const pending = Array.from(metricsByTicket.values()).reduce((sum, item) => sum + item.available, 0);
  const allActive = tickets.map((ticket): BoloesScreenData["active"]["all"][number] => {
    const metrics = metricsByTicket.get(ticket.id) ?? {
      sent: 0,
      total: 0,
      available: 0,
      progress: 0,
      position: null,
      points: 0,
    };

    if (ticket.ticketType === "general") {
      return {
        id: ticket.id,
        type: "principal",
        title: "Bolão da Copa 2026",
        cotaLabel: `Cota #${shortTicketId(ticket.id)}`,
        href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status: "ativo",
        statusLabel: "Ativo",
        sent: metrics.sent,
        total: metrics.total,
        progress: metrics.progress,
        position: metrics.position,
        points: metrics.points,
      };
    }

    const date = ticket.playDate || playableDate;
    const dateMatches = Array.from(matches.values()).filter((match) => match.dateBR === date);
    const closeAt = nextLockMs(dateMatches.filter((match) => isOpenMatch(match)));
    const status: ActiveDailyStatus = ticket.dailyStatus === "usado" ? "usado" : ticket.dailyStatus === "em_uso" ? "ativo" : "aguardando";
    return {
      id: ticket.id,
      type: "diario",
      title: "Bolão do Dia",
      cotaLabel: `Cota #${shortTicketId(ticket.id)}`,
      href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
      status,
      statusLabel: status === "usado" ? "Usado" : status === "ativo" ? "Ativo" : "Aguardando início",
      gamesCount: dateMatches.length,
      countdownLabel: status === "aguardando" ? "Início em" : "Fecha em",
      countdownTargetMs: closeAt,
      position: metrics.position,
      points: metrics.points,
    };
  });

  const active = {
    principal: firstGeneral
      ? (() => {
          const metrics = metricsByTicket.get(firstGeneral.id)!;
          return {
            id: firstGeneral.id,
            title: "Bolão da Copa 2026",
            cotaLabel: `Cota #${shortTicketId(firstGeneral.id)}`,
            href: `/palpites?${new URLSearchParams({ ticket: firstGeneral.id }).toString()}`,
            status: "ativo" as const,
            statusLabel: "Ativo",
            sent: metrics.sent,
            total: metrics.total,
            progress: metrics.progress,
            position: metrics.position,
            points: metrics.points,
          };
        })()
      : null,
    diario: firstDaily
      ? (() => {
          const metrics = metricsByTicket.get(firstDaily.id)!;
          const date = firstDaily.playDate || playableDate;
          const dateMatches = Array.from(matches.values()).filter((match) => match.dateBR === date);
          const closeAt = nextLockMs(dateMatches.filter((match) => isOpenMatch(match)));
          const status: ActiveDailyStatus = firstDaily.dailyStatus === "usado" ? "usado" : firstDaily.dailyStatus === "em_uso" ? "ativo" : "aguardando";
          return {
            id: firstDaily.id,
            title: "Bolão do Dia",
            cotaLabel: `Cota #${shortTicketId(firstDaily.id)}`,
            href: `/palpites?${new URLSearchParams({ ticket: firstDaily.id }).toString()}`,
            status,
            statusLabel: status === "usado" ? "Usado" : status === "ativo" ? "Ativo" : "Aguardando início",
            gamesCount: dateMatches.length,
            countdownLabel: status === "aguardando" ? "Início em" : "Fecha em",
            countdownTargetMs: closeAt,
            position: metrics.position,
            points: metrics.points,
          };
        })()
      : null,
    all: allActive,
  };

  const data: BoloesScreenData = {
    summary: {
      activeCount: tickets.length,
      pendingPredictions: pending,
      bestPosition: positions.length ? Math.min(...positions) : null,
    },
    active,
    upcoming: {
      daily: {
        href: "/tickets?bolao=diario",
        gamesCount: dailyMatchesCount,
        closesAtMs: dailyCloseAtMs,
        priceLabel: formatBRL(getTicketPriceCents("daily")),
      },
      principal: {
        href: "/tickets",
        priceLabel: formatBRL(getTicketPriceCents("general")),
        closesAtMs: generalCloseAtMs,
      },
    },
  };

  debugBoloes("resolved", {
    playableDate,
    dailyMatchesCount,
    dailyCloseAtMs,
    generalOpenMatchesCount: generalOpenMatches.length,
    generalCloseAtMs,
    summary: data.summary,
    activePrincipal: data.active.principal,
    activeDiario: data.active.diario,
    allActiveCount: data.active.all.length,
    allActive: data.active.all,
    upcoming: data.upcoming,
  });

  return data;
}

export default async function BoloesPage() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;
  debugBoloes("request", { hasToken: Boolean(token), userId });
  const data = userId ? await loadBoloesData(userId) : null;
  if (!userId) debugBoloes("no authenticated user", {});
  return <BoloesClient data={data} />;
}
