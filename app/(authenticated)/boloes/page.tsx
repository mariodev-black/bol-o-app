
import { Suspense } from "react";
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listPaidTicketsForUser, type PaidTicketRow } from "@/lib/payments/user-tickets";
import { getExtraBolaoUnitCents, getTicketPriceCents } from "@/lib/payments/ticket-config";
import {
  calcPredictionPoints,
  countParticipantsByBolaoType,
  listDistinctExtraPredictionTicketIds,
  listPredictions,
  listPredictionsForGlobalRanking,
  palpiteLockBeforeKickoffMs,
  type PredictionRankingRow,
  type PredictionRow,
} from "@/lib/predictions";
import { fetchMatchesMap, getMatchFromMap, type MatchMapEntry } from "@/lib/football-api";
import { BoloesClient, type BoloesScreenData } from "@/app/(authenticated)/boloes/BoloesClient";
import { BoloesPurchaseSync } from "@/app/(authenticated)/boloes/_components/BoloesPurchaseSync";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { extraBolaoFallbackDisplayName } from "@/lib/boloes-extra-competition-branding";
import { warmCompetitionMetadataCache } from "@/lib/competition-metadata-cache";
import {
  fetchExtraChampionshipIdByTicketIds,
  matchCompetitionForRankingPrediction,
  mergeExtraChampionshipFromPaidTickets,
} from "@/lib/ticket-competition-server";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import { extraBolaoCurrentRoundsByChampionship } from "@/lib/ticket-shop-extra-rounds";

function extraBolaoDisplayTitle(
  championshipId: number,
  baseName: string,
  rounds: Record<number, { roundLabel: string }>,
): string {
  const round = rounds[championshipId]?.roundLabel?.trim();
  return round ? `${baseName} · ${round}` : baseName;
}

/** Minutos apos apito que consideramos a partida ja encerrada (debug-only nesta rota). */
function matchEndClockMinutesAfterKickoff(): number {
  const n = Number.parseInt((process.env.MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES || "115").trim(), 10);
  if (!Number.isFinite(n)) return 115;
  return Math.min(300, Math.max(45, n));
}

export const dynamic = "force-dynamic";

import { getTicketShopFlags, parseEnvBool } from "@/lib/ticket-shop-flags";

const PALPITE_LOCK_MS_PRINCIPAL = palpiteLockBeforeKickoffMs("principal");
const PALPITE_LOCK_MS_DIARIO = palpiteLockBeforeKickoffMs("diario");
const PALPITE_LOCK_MS_EXTRA = palpiteLockBeforeKickoffMs("extra");

type MatchMap = Awaited<ReturnType<typeof fetchMatchesMap>>;
type MatchInfo = MatchMapEntry;

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
  if (!parseEnvBool(process.env.DEBUG_BOLAOES)) return;
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

function lockMs(match: MatchInfo, leadMs: number): number | null {
  const kickoff = kickoffMs(match);
  return kickoff == null ? null : kickoff - leadMs;
}

function isOpenMatch(match: MatchInfo, leadMs: number, now = Date.now()): boolean {
  if (isFinishedStatus(match.status)) return false;
  const lock = lockMs(match, leadMs);
  if (lock != null) return lock > now;
  const matchDate = brDateToUtcMs(match.dateBR);
  const today = brDateToUtcMs(todayBR());
  return matchDate != null && today != null && matchDate >= today;
}

function nextLockMs(matches: MatchInfo[], leadMs: number, now = Date.now()): number | null {
  const locks = matches
    .map((m) => lockMs(m, leadMs))
    .filter((value): value is number => value != null && value > now)
    .sort((a, b) => a - b);
  return locks[0] ?? null;
}

function competitionIdsEnsureFromPaidTickets(tickets: PaidTicketRow[]): number[] {
  const sole = getSoleConfiguredExtraChampionshipId();
  const out: number[] = [];
  for (const t of tickets) {
    if (t.ticketType !== "extra") continue;
    const c = Number(t.extraChampionshipId);
    if (Number.isFinite(c) && c > 0) out.push(c);
    else if (sole != null && sole > 0) out.push(sole);
  }
  return out;
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
  const mainComp = getFootballMainCompetitionId();
  if (ticket.ticketType === "daily") {
    const date = ticket.playDate || resolveDiarioPlayableDate(matches, { competitionId: mainComp });
    return Array.from(matches.values()).filter(
      (m) =>
        m.dateBR === date &&
        (Number(m.competitionId) || mainComp) === mainComp &&
        !isFinishedStatus(m.status),
    ).length;
  }
  if (ticket.ticketType === "extra") {
    const comp = Number(ticket.extraChampionshipId);
    if (!Number.isFinite(comp) || comp <= 0) return 0;
    const date = ticket.playDate || resolveDiarioPlayableDate(matches, { competitionId: comp });
    return Array.from(matches.values()).filter(
      (m) =>
        m.dateBR === date &&
        (Number(m.competitionId) || comp) === comp &&
        !isFinishedStatus(m.status),
    ).length;
  }
  return Array.from(matches.values()).filter((match) => !isFinishedStatus(match.status)).length;
}

function buildRankingMap(
  predictions: PredictionRankingRow[],
  matches: MatchMap,
  extraChampionshipByTicketId: Map<string, number>
): Map<string, { pos: number; points: number }> {
  const mainComp = getFootballMainCompetitionId();
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
    const comp = matchCompetitionForRankingPrediction(prediction, extraChampionshipByTicketId, mainComp);
    if (comp == null || !Number.isFinite(comp) || comp <= 0) continue;
    const match = getMatchFromMap(matches, comp, matchId);
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

async function loadBoloesData(userId: string): Promise<BoloesScreenData> {
  const configuredExtraIds = parseExtraBolaoChampionshipIds();
  const mainComp = getFootballMainCompetitionId();
  const [
    tickets,
    userPredictions,
    allPredictions,
    extraTicketIdsFromPreds,
    competitionLabels,
    participantsByBolao,
    extraRounds,
  ] = await Promise.all([
    listPaidTicketsForUser(userId),
    listPredictions({ userId }).catch(() => []),
    listPredictionsForGlobalRanking().catch(() => []),
    listDistinctExtraPredictionTicketIds().catch(() => [] as string[]),
    warmCompetitionMetadataCache(configuredExtraIds).catch(() => ({}) as Record<number, string>),
    countParticipantsByBolaoType().catch(() => ({ principal: 0, diario: 0, extra: 0 })),
    extraBolaoCurrentRoundsByChampionship(configuredExtraIds).catch(() => ({})),
  ]);

  const ensureCompIds = competitionIdsEnsureFromPaidTickets(tickets);
  const matches = await fetchMatchesMap({ ensureCompetitionIds: ensureCompIds }).catch(() => new Map());

  debugBoloes("load:start", {
    userId,
    ticketsCount: tickets.length,
    matchesCount: matches.size,
    userPredictionsCount: userPredictions.length,
    allPredictionsCount: allPredictions.length,
    ensureCompetitionIdsFromTickets: ensureCompIds,
    envSyncedCompetitionIds: [...new Set([mainComp, ...configuredExtraIds])],
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

  const extraTicketIds = [...new Set(extraTicketIdsFromPreds)];
  const extraChampionshipByTicketId = await fetchExtraChampionshipIdByTicketIds(extraTicketIds);
  mergeExtraChampionshipFromPaidTickets(extraChampionshipByTicketId, tickets);
  const ranking = buildRankingMap(allPredictions, matches, extraChampionshipByTicketId);

  const extraTicketIdSet = new Set(tickets.filter((t) => t.ticketType === "extra").map((t) => String(t.id).trim()));
  const byCompetitionRowCount: Record<string, number> = {};
  let withPlacarAny = 0;
  for (const m of matches.values()) {
    const k = String(Number(m.competitionId) || mainComp);
    byCompetitionRowCount[k] = (byCompetitionRowCount[k] ?? 0) + 1;
    if (m.resultCasa != null && m.resultVisitante != null) withPlacarAny += 1;
  }
  debugBoloes("ranking:cache", {
    mapSize: matches.size,
    rowsByCompetitionId: byCompetitionRowCount,
    rowsWithOfficialScoreAnyComp: withPlacarAny,
    extraChampionshipByTicketIdCount: extraChampionshipByTicketId.size,
    extraChampionshipByTicketIdEntries: Object.fromEntries([...extraChampionshipByTicketId].slice(0, 12)),
  });
  debugBoloes(
    "ranking:sample-user-extra-preds",
    userPredictions
      .filter((p) => extraTicketIdSet.has(String(p.ticket_id).trim()))
      .slice(0, 14)
      .map((p) => {
        const comp = matchCompetitionForRankingPrediction(p, extraChampionshipByTicketId, mainComp);
        const mid = Number(p.match_id);
        const m =
          comp != null && Number.isFinite(comp) && comp > 0 && Number.isFinite(mid)
            ? getMatchFromMap(matches, comp, mid)
            : undefined;
        return {
          ticket_id: String(p.ticket_id).trim(),
          bolao_type: p.bolao_type,
          match_id: mid,
          resolvedComp: comp,
          cacheHit: Boolean(m),
          status: m?.status ?? null,
          resultCasa: m?.resultCasa ?? null,
          resultVisitante: m?.resultVisitante ?? null,
          dateBR: m?.dateBR ?? null,
          hour: m?.hour ?? null,
        };
      })
  );
  const clockMinBoloes = matchEndClockMinutesAfterKickoff();
  const nowBoloesDbg = Date.now();
  debugBoloes(
    "ranking:extra-sem-placar-completo",
    userPredictions
      .filter((p) => extraTicketIdSet.has(String(p.ticket_id).trim()))
      .map((p) => {
        const comp = matchCompetitionForRankingPrediction(p, extraChampionshipByTicketId, mainComp);
        const mid = Number(p.match_id);
        const m =
          comp != null && Number.isFinite(comp) && comp > 0 && Number.isFinite(mid)
            ? getMatchFromMap(matches, comp, mid)
            : undefined;
        const ko = m ? kickoffMs(m) : null;
        const missing = Boolean(m && (m.resultCasa == null || m.resultVisitante == null));
        const pastEndClock =
          missing && ko != null ? ko + clockMinBoloes * 60_000 < nowBoloesDbg : false;
        return {
          ticket_id: String(p.ticket_id).trim(),
          match_id: mid,
          resolvedComp: comp,
          cacheHit: Boolean(m),
          status: m?.status ?? null,
          resultCasa: m?.resultCasa ?? null,
          resultVisitante: m?.resultVisitante ?? null,
          kickoffMs: ko,
          matchEndClockAfterKickoffMin: clockMinBoloes,
          pastMatchEndClockNoFullScore: pastEndClock,
          dateBR: m?.dateBR ?? null,
          hour: m?.hour ?? null,
        };
      })
      .filter((row) => row.cacheHit && (row.resultCasa == null || row.resultVisitante == null))
  );
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
  const playableDate = resolveDiarioPlayableDate(matches, { competitionId: mainComp });
  const playableDateMatches = Array.from(matches.values()).filter(
    (match) =>
      match.dateBR === playableDate &&
      isOpenMatch(match, PALPITE_LOCK_MS_DIARIO) &&
      (Number(match.competitionId) || mainComp) === mainComp,
  );
  const dailyMatchesCount = playableDateMatches.length;
  const dailyCloseAtMs = nextLockMs(playableDateMatches, PALPITE_LOCK_MS_DIARIO);
  const generalOpenMatches = Array.from(matches.values()).filter((match) =>
    isOpenMatch(match, PALPITE_LOCK_MS_PRINCIPAL),
  );
  const generalCloseAtMs = nextLockMs(generalOpenMatches, PALPITE_LOCK_MS_PRINCIPAL);
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
        title: "Bolão do Milhão",
        cotaLabel: `Cota #${shortTicketId(ticket.id)}`,
        href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status: "ativo",
        statusLabel: "Ativo",
        sent: metrics.sent,
        total: metrics.total,
        progress: metrics.progress,
        position: metrics.position,
        points: metrics.points,
        participantCount: participantsByBolao.principal,
      };
    }

    if (ticket.ticketType === "extra") {
      const compId = Number(ticket.extraChampionshipId);
      const safeComp = Number.isFinite(compId) && compId > 0 ? compId : 0;
      const baseName =
        safeComp > 0
          ? (competitionLabels[safeComp] ?? extraBolaoFallbackDisplayName(safeComp))
          : "Bolão extra";
      const title =
        safeComp > 0 ? extraBolaoDisplayTitle(safeComp, baseName, extraRounds) : baseName;
      const date =
        ticket.playDate ||
        (safeComp > 0 ? resolveDiarioPlayableDate(matches, { competitionId: safeComp }) : playableDate);
      const dateMatches = Array.from(matches.values()).filter(
        (m) =>
          m.dateBR === date &&
          (safeComp <= 0 || (Number(m.competitionId) || safeComp) === safeComp),
      );
      const closeAt = nextLockMs(
        dateMatches.filter((m) => isOpenMatch(m, PALPITE_LOCK_MS_EXTRA)),
        PALPITE_LOCK_MS_EXTRA,
      );
      const status: ActiveDailyStatus =
        ticket.dailyStatus === "usado" ? "usado" : ticket.dailyStatus === "em_uso" ? "ativo" : "aguardando";
      return {
        id: ticket.id,
        type: "extra",
        championshipId: safeComp > 0 ? safeComp : undefined,
        title,
        cotaLabel: `Cota #${shortTicketId(ticket.id)}`,
        href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status,
        statusLabel:
          status === "usado" ? "Usado" : status === "ativo" ? "Em uso — seu dia" : "Aguardando início",
        gamesCount: dateMatches.length,
        countdownLabel: status === "aguardando" ? "Início em" : "Fecha em",
        countdownTargetMs: closeAt,
        position: metrics.position,
        points: metrics.points,
        participantCount: participantsByBolao.extra,
      };
    }

    const date = ticket.playDate || playableDate;
    const dateMatches = Array.from(matches.values()).filter(
      (match) =>
        match.dateBR === date && (Number(match.competitionId) || mainComp) === mainComp,
    );
    const closeAt = nextLockMs(
      dateMatches.filter((match) => isOpenMatch(match, PALPITE_LOCK_MS_DIARIO)),
      PALPITE_LOCK_MS_DIARIO,
    );
    const status: ActiveDailyStatus =
      ticket.dailyStatus === "usado" ? "usado" : ticket.dailyStatus === "em_uso" ? "ativo" : "aguardando";
    return {
      id: ticket.id,
      type: "diario",
      title: "Bolão do Dia",
      cotaLabel: `Cota #${shortTicketId(ticket.id)}`,
      href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
      status,
      statusLabel: status === "usado" ? "Usado" : status === "ativo" ? "Em uso — seu dia" : "Aguardando início",
      gamesCount: dateMatches.length,
      countdownLabel: status === "aguardando" ? "Início em" : "Fecha em",
      countdownTargetMs: closeAt,
      position: metrics.position,
      points: metrics.points,
      participantCount: participantsByBolao.diario,
    };
  });

  const active = {
    principal: firstGeneral
      ? (() => {
          const metrics = metricsByTicket.get(firstGeneral.id)!;
          return {
            id: firstGeneral.id,
            title: "Bolão do Milhão",
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
          const dateMatches = Array.from(matches.values()).filter(
            (match) =>
              match.dateBR === date && (Number(match.competitionId) || mainComp) === mainComp,
          );
          const closeAt = nextLockMs(
            dateMatches.filter((match) => isOpenMatch(match, PALPITE_LOCK_MS_DIARIO)),
            PALPITE_LOCK_MS_DIARIO,
          );
          const status: ActiveDailyStatus =
            firstDaily.dailyStatus === "usado" ? "usado" : firstDaily.dailyStatus === "em_uso" ? "ativo" : "aguardando";
          return {
            id: firstDaily.id,
            title: "Bolão do Dia",
            cotaLabel: `Cota #${shortTicketId(firstDaily.id)}`,
            href: `/palpites?${new URLSearchParams({ ticket: firstDaily.id }).toString()}`,
            status,
            statusLabel:
              status === "usado" ? "Usado" : status === "ativo" ? "Em uso — seu dia" : "Aguardando início",
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
    participantsByBolao,
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
      extras: configuredExtraIds.map((championshipId) => {
        const pd = resolveDiarioPlayableDate(matches, { competitionId: championshipId });
        const dateMatches = Array.from(matches.values()).filter(
          (m) =>
            m.dateBR === pd && (Number(m.competitionId) || championshipId) === championshipId,
        );
        const openOnDate = dateMatches.filter((m) => isOpenMatch(m, PALPITE_LOCK_MS_EXTRA));
        const baseName =
          competitionLabels[championshipId] ??
          extraBolaoFallbackDisplayName(championshipId);
        return {
          championshipId,
          title: extraBolaoDisplayTitle(championshipId, baseName, extraRounds),
          href: `/tickets?bolao=extra&championshipId=${championshipId}`,
          gamesCount: openOnDate.length,
          closesAtMs: nextLockMs(openOnDate, PALPITE_LOCK_MS_EXTRA),
          priceLabel: formatBRL(getExtraBolaoUnitCents()),
        };
      }),
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
  const { ticketsExtraOnly, ticketsHideDaily } = getTicketShopFlags();
  if (!userId) debugBoloes("no authenticated user", {});
  return (
    <>
      <Suspense fallback={null}>
        <BoloesPurchaseSync />
      </Suspense>
      <BoloesClient
        data={data}
        ticketsExtraOnly={ticketsExtraOnly}
        ticketsHideDaily={ticketsHideDaily}
      />
    </>
  );
}
