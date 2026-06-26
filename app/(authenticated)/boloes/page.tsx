
import { Suspense } from "react";
import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listPaidTicketsForUser, type PaidTicketRow } from "@/lib/payments/user-tickets";
import { getExtraBolaoUnitCents, getTicketPriceCents } from "@/lib/payments/ticket-config";
import {
  countParticipantsByBolaoType,
  listPredictions,
  palpiteLockBeforeKickoffMs,
  type PredictionRow,
} from "@/lib/predictions";
import { fetchMatchesMap, type MatchMapEntry } from "@/lib/football-api";
import { BoloesClient, type BoloesScreenData } from "@/app/(authenticated)/boloes/BoloesClient";
import { BoloesPurchaseSync } from "@/app/(authenticated)/boloes/_components/BoloesPurchaseSync";
import { BoloesLoadingSkeleton } from "@/app/(authenticated)/boloes/loading";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  ensureSkaleBolaoMatchesMirrored,
  skaleCompetitionIdsForMatchMap,
} from "@/lib/boloes/skale-match-resolve";
import { ensureWeekendBolaoMatchesMirrored } from "@/lib/football/weekend-bolao-sync";
import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import {
  effectiveExtraRoundForPaidTicket,
  extraBolaoTitleForPaidTicket,
  formatExtraRoundLabel,
} from "@/lib/ticket-shop-extra-display";
import { readCompetitionDisplayNamesFromDb } from "@/lib/competition-metadata-cache";
import { resolvePaidTicketRankingPositions } from "@/lib/ranking/leaderboard";
import {
  dailyEditionCardTitle,
  formatDailyEditionCardSubtitle,
  formatDailyEditionDatesLabel,
  getDailyEdition,
  isMatchInDailyEditionScope,
  listGroupStageDailyEditions,
  resolveShopDailyEdition,
} from "@/lib/boloes/daily-editions";
import {
  getSkaleDailyBolaoCompetitionId,
  getSkaleDailyBolaoUnitCents,
  isSkaleDailyBolaoCompetition,
  isSkaleDailyBolaoEnabled,
  paidTicketSkaleDailyEditionNumber,
  skaleDailyEditionCardTitle,
} from "@/lib/boloes/skale-daily-config";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { resolveDailyEditionStatus } from "@/lib/boloes/daily-editions-server";
import {
  ARTILHEIROS_BOLAO_SUBTITLE,
  ARTILHEIROS_BOLAO_TITLE,
} from "@/lib/artilheiros/config";
import { isArtilheiroResultApplied, listArtilheiroOfficialResults } from "@/lib/artilheiros/results";
import { buildArtilheiroRanking, countArtilheirosParticipants } from "@/lib/artilheiros/ranking";
import {
  getArtilheirosTicketPriceCents,
  isArtilheirosBolaoEnabled,
} from "@/lib/artilheiros/config";
import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import {
  bolaoDisplayStatusMeta,
  computeBolaoDisplayPhase,
} from "@/lib/boloes/display-status";
import {
  bolaoPhaseScopeForPaidTicket,
  bolaoPhaseScopeFromPredictions,
  matchEntriesFromPredictions,
  scopeMatchesForPaidTicket,
  type ScopeMatchesForPaidTicketOpts,
} from "@/lib/boloes/ticket-match-scope";
import {
  extraBolaoCurrentRoundsByChampionship,
  type ExtraBolaoRoundInfo,
} from "@/lib/ticket-shop-extra-rounds";

export const dynamic = "force-dynamic";

import { getTicketShopFlags, parseEnvBool } from "@/lib/ticket-shop-flags";

const PALPITE_LOCK_MS_PRINCIPAL = palpiteLockBeforeKickoffMs("principal");
const PALPITE_LOCK_MS_DIARIO = palpiteLockBeforeKickoffMs("diario");
const PALPITE_LOCK_MS_EXTRA = palpiteLockBeforeKickoffMs("extra");

type MatchMap = Awaited<ReturnType<typeof fetchMatchesMap>>;
type MatchInfo = MatchMapEntry;

function matchInDailyEditionPool(
  match: MatchInfo,
  editionNumber: number | null | undefined,
  editionDates: string[],
  mainComp: number,
  scopeComp?: number,
): boolean {
  const comp = Number(match.competitionId) || mainComp;
  if (scopeComp != null) {
    if (comp !== scopeComp && comp !== mainComp) return false;
  } else if (comp !== mainComp) {
    return false;
  }
  if (match.dateBR == null) return false;
  if (editionNumber != null) {
    return isMatchInDailyEditionScope(
      { dateBR: match.dateBR, hour: match.hour, kickoffAt: match.kickoffAt },
      editionNumber,
    );
  }
  return editionDates.includes(match.dateBR);
}

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

function formatCotaLabel(ordinal: number): string {
  return `Cota #${String(ordinal).padStart(2, "0")}`;
}

/** Chave do bolão para numeração de cotas — cada grupo reinicia em 01. */
function ticketCotaGroupKey(ticket: PaidTicketRow): string {
  if (ticket.bolaoDefinitionId) return `def:${ticket.bolaoDefinitionId}`;
  if (ticket.ticketType === "general") return "general";
  if (ticket.ticketType === "artilheiros") return "artilheiros";
  if (ticket.ticketType === "daily") {
    const edition = ticket.dailyEditionNumber ?? 0;
    return `daily:${edition}`;
  }
  if (ticket.ticketType === "extra") {
    const comp = Number(ticket.extraChampionshipId) || 0;
    if (isSkaleDailyBolaoCompetition(comp)) {
      const edition =
        ticket.skaleDailyEditionNumber ??
        paidTicketSkaleDailyEditionNumber({
          ticketType: "extra",
          extraChampionshipId: comp,
          extraRoundNumber: ticket.extraRoundNumber,
          round_number: ticket.extraRoundNumber,
        }) ??
        0;
      return `skale-daily:${edition}`;
    }
    if (isSkaleBolaoCompetition(comp)) return "skale-integral";
    const round = ticket.extraRoundNumber ?? "all";
    return `extra:${comp}:${round}`;
  }
  return `ticket:${ticket.id}`;
}

/**
 * Numeração por bolão (01, 02… reinicia em cada grupo), ordenada por data de compra.
 */
function buildCotaOrdinalByTicketId(tickets: PaidTicketRow[]): Map<string, number> {
  const sorted = [...tickets].sort((a, b) => {
    const aMs = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime();
    const bMs = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime();
    if (aMs !== bMs) return aMs - bMs;
    return a.id.localeCompare(b.id);
  });

  const counters = new Map<string, number>();
  const out = new Map<string, number>();
  for (const ticket of sorted) {
    const key = ticketCotaGroupKey(ticket);
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    out.set(ticket.id, next);
  }
  return out;
}

function cotaLabelForTicket(ticket: PaidTicketRow, ordinalByTicketId: Map<string, number>): string {
  return formatCotaLabel(ordinalByTicketId.get(ticket.id) ?? 1);
}

function scopeOptsForTicket(
  ticket: PaidTicketRow,
  effectiveExtraRoundByTicketId: Map<string, number>,
): ScopeMatchesForPaidTicketOpts | undefined {
  if (ticket.ticketType !== "extra") return undefined;
  const round = effectiveExtraRoundByTicketId.get(ticket.id);
  return round != null ? { extraRoundNumber: round } : undefined;
}

function totalMatchesForTicket(
  ticket: PaidTicketRow,
  matches: MatchMap,
  scopeOpts?: ScopeMatchesForPaidTicketOpts,
): number {
  return scopeMatchesForPaidTicket(ticket, matches, scopeOpts).filter(
    (m) => !isFinishedStatus(m.status),
  ).length;
}

function bolaoStatusFromMetrics(
  ticket: PaidTicketRow,
  metrics: TicketMetrics,
  matches: MatchMap,
  predictionMatchIds?: number[],
  scopeOpts?: ScopeMatchesForPaidTicketOpts,
): { displayPhase: ReturnType<typeof computeBolaoDisplayPhase>; statusLabel: string } {
  const predictionScopeMatches = bolaoPhaseScopeFromPredictions(
    ticket,
    matches,
    predictionMatchIds,
  );
  const displayPhase = computeBolaoDisplayPhase({
    sent: metrics.sent,
    total: metrics.total,
    available: metrics.available,
    scopeMatches: bolaoPhaseScopeForPaidTicket(
      ticket,
      matches,
      predictionMatchIds,
      scopeOpts,
    ),
    predictionScopeMatches,
    dailyStatus: ticket.dailyStatus ?? null,
  });
  const meta = bolaoDisplayStatusMeta(displayPhase);
  return {
    displayPhase,
    statusLabel: meta.label,
  };
}

async function loadBoloesData(userId: string): Promise<BoloesScreenData> {
  const configuredExtraIds = parseExtraBolaoChampionshipIds();
  const mainComp = getFootballMainCompetitionId();
  // Os dois espelhamentos (Skale/Weekend a partir da Copa) são independentes —
  // rodam em paralelo. Mantemos o await aqui porque o fetchMatchesMap abaixo
  // lê o que eles escrevem (read-after-write).
  await Promise.all([
    ensureSkaleBolaoMatchesMirrored().catch(() => {}),
    ensureWeekendBolaoMatchesMirrored().catch(() => {}),
  ]);
  const preloadCompIds = [
    ...new Set([mainComp, ...configuredExtraIds, ...skaleCompetitionIdsForMatchMap()]),
  ];
  const matchesPromise = fetchMatchesMap({ ensureCompetitionIds: preloadCompIds }).catch(
    () => new Map(),
  );
  const [
    matches,
    tickets,
    userPredictions,
    competitionLabels,
    participantsByBolao,
    artilheirosParticipants,
    extraRounds,
  ] = await Promise.all([
    matchesPromise,
    matchesPromise.then((m) => listPaidTicketsForUser(userId, { matchMap: m })),
    listPredictions({ userId }).catch(() => []),
    readCompetitionDisplayNamesFromDb(configuredExtraIds)
      .then((fromDb) => {
        const out: Record<number, string> = {};
        for (const id of configuredExtraIds) {
          out[id] = fromDb[id] ?? resolveExtraBolaoDisplayName(id, null);
        }
        return out;
      })
      .catch(() => ({}) as Record<number, string>),
    countParticipantsByBolaoType().catch(() => ({ principal: 0, diario: 0, extra: 0 })),
    countArtilheirosParticipants().catch(() => 0),
    extraBolaoCurrentRoundsByChampionship(configuredExtraIds).catch(
      () => ({}) as Record<number, ExtraBolaoRoundInfo>,
    ),
  ]);

  /** Cada cota mantém `tickets.round_number` — não avança rodada na vitrine. */
  const effectiveExtraRoundByTicketId = new Map<string, number>();
  for (const ticket of tickets.filter((t) => t.ticketType === "extra")) {
    const comp = Number(ticket.extraChampionshipId);
    if (!Number.isFinite(comp) || comp <= 0) continue;
    if (isSkaleDailyBolaoCompetition(comp) || isSkaleBolaoCompetition(comp)) continue;
    const round = effectiveExtraRoundForPaidTicket({
      championshipId: comp,
      roundNumberFromDb: ticket.extraRoundNumber,
      liveRoundNumber: extraRounds[comp]?.roundNumber ?? null,
    });
    if (round != null) effectiveExtraRoundByTicketId.set(ticket.id, round);
  }

  debugBoloes("load:start", {
    userId,
    ticketsCount: tickets.length,
    matchesCount: matches.size,
    userPredictionsCount: userPredictions.length,
    ensureCompetitionIdsFromTickets: competitionIdsEnsureFromPaidTickets(tickets),
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

  const ranking = new Map<string, { pos: number | null; points: number }>();
  const nonArtilheiroTickets = tickets
    .filter((t) => t.ticketType !== "artilheiros")
    .map((ticket) => ({
      id: ticket.id,
      ticketType: ticket.ticketType as "general" | "daily" | "extra",
    }));
  if (nonArtilheiroTickets.length > 0) {
    try {
      const scoped = await resolvePaidTicketRankingPositions(nonArtilheiroTickets, userId);
      for (const ticket of nonArtilheiroTickets) {
        const scopedRow = scoped.get(ticket.id);
        ranking.set(ticket.id, {
          pos: scopedRow?.position ?? null,
          points: scopedRow?.points ?? 0,
        });
      }
    } catch (error) {
      console.error("[boloes] failed to resolve scoped ranking positions", error);
    }
  }
  const predictionsByTicket = new Map<string, PredictionRow[]>();
  for (const prediction of userPredictions) {
    const arr = predictionsByTicket.get(prediction.ticket_id) ?? [];
    arr.push(prediction);
    predictionsByTicket.set(prediction.ticket_id, arr);
  }

  const metricsByTicket = new Map<string, TicketMetrics>();
  for (const ticket of tickets) {
    const scopeOpts = scopeOptsForTicket(ticket, effectiveExtraRoundByTicketId);
    const sent = predictionsByTicket.get(ticket.id)?.length ?? 0;
    const available = Math.max(0, Number(ticket.availableGames ?? 0));
    const total = Math.max(
      sent + available,
      totalMatchesForTicket(ticket, matches, scopeOpts),
      sent,
    );
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
  const cotaOrdinalByTicketId = buildCotaOrdinalByTicketId(tickets);
  const hasArtilheirosTickets = tickets.some((ticket) => ticket.ticketType === "artilheiros");
  const artilheiroResults = hasArtilheirosTickets
    ? await listArtilheiroOfficialResults().catch(() => [])
    : [];
  const artilheiroResultsApplied = isArtilheiroResultApplied(artilheiroResults);
  const artilheiroRanking =
    hasArtilheirosTickets && artilheiroResultsApplied
      ? await buildArtilheiroRanking(5000).catch(() => [])
      : [];
  const artilheiroRankByTicket = new Map(
    artilheiroRanking.map((r) => [r.ticketId, { position: r.position, points: r.totalPoints }]),
  );
  const allActive = tickets.map((ticket): BoloesScreenData["active"]["all"][number] => {
    const scopeOpts = scopeOptsForTicket(ticket, effectiveExtraRoundByTicketId);
    const metrics = metricsByTicket.get(ticket.id) ?? {
      sent: 0,
      total: 0,
      available: 0,
      progress: 0,
      position: null,
      points: 0,
    };
    const predictionMatchIds = (predictionsByTicket.get(ticket.id) ?? [])
      .map((p) => Number(p.match_id))
      .filter((id): id is number => Number.isFinite(id));

    if (ticket.ticketType === "artilheiros") {
      const picksCount = ticket.palpitesCount ?? 0;
      const total = 3;
      const sent = picksCount;
      const available = Math.max(0, total - sent);
      const artRank = artilheiroRankByTicket.get(ticket.id);
      const displayPhase =
        artilheiroResultsApplied
          ? "finalizado"
          : sent >= total
            ? "enviados"
            : "pendentes";
      const statusLabel =
        displayPhase === "finalizado"
          ? "Encerrado"
          : displayPhase === "enviados"
            ? "Palpites enviados"
            : "Palpites pendentes";
      const legacyStatus =
        displayPhase === "finalizado"
          ? "usado"
          : displayPhase === "pendentes"
            ? "aguardando"
            : "ativo";
      return {
        id: ticket.id,
        type: "artilheiros",
        title: ARTILHEIROS_BOLAO_TITLE,
        subtitle: ARTILHEIROS_BOLAO_SUBTITLE,
        cotaLabel: cotaLabelForTicket(ticket, cotaOrdinalByTicketId),
        href: `/palpites/artilheiros?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status: legacyStatus as ActiveDailyStatus,
        displayPhase,
        statusLabel,
        sent,
        total,
        gamesCount: available,
        countdownLabel: displayPhase === "finalizado" ? "Encerrado" : "Escolher artilheiros",
        countdownTargetMs: null,
        position: artRank?.position ?? null,
        points: artRank?.points ?? 0,
        participantCount: artilheiroRanking.length,
      };
    }

    if (ticket.ticketType === "general") {
      const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
        ticket,
        metrics,
        matches,
        predictionMatchIds,
        scopeOpts,
      );
      const legacyStatus = displayPhase === "finalizado" ? "usado" : "ativo";
      return {
        id: ticket.id,
        type: "principal",
        title: "Bolão do Milhão",
        cotaLabel: cotaLabelForTicket(ticket, cotaOrdinalByTicketId),
        href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status: legacyStatus,
        displayPhase,
        statusLabel,
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

      if (isSkaleDailyBolaoCompetition(safeComp)) {
        const editionNum = paidTicketSkaleDailyEditionNumber(ticket);
        const editionMeta =
          editionNum != null ? getDailyEdition(editionNum) : null;
        const editionDates = editionMeta?.datesBR ?? [];
        const dateMatches = Array.from(matches.values()).filter((match) =>
          matchInDailyEditionPool(match, editionNum, editionDates, mainComp, safeComp),
        );
        const closeAt = nextLockMs(
          dateMatches.filter((match) => isOpenMatch(match, PALPITE_LOCK_MS_DIARIO)),
          PALPITE_LOCK_MS_DIARIO,
        );
        const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
          ticket,
          metrics,
          matches,
          predictionMatchIds,
          scopeOpts,
        );
        const legacyStatus =
          displayPhase === "finalizado"
            ? "usado"
            : displayPhase === "pendentes"
              ? "aguardando"
              : "ativo";
        const skaleDailyTitle =
          editionNum != null
            ? skaleDailyEditionCardTitle(editionNum)
            : "Diário Skale";
        const dailyEditionDatesLabel = editionMeta
          ? formatDailyEditionCardSubtitle(editionMeta)
          : null;
        return {
          id: ticket.id,
          type: "diario",
          championshipId: safeComp,
          isSkaleDaily: true,
          title: skaleDailyTitle,
          dailyEditionDatesLabel,
          cotaLabel: cotaLabelForTicket(ticket, cotaOrdinalByTicketId),
          href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
          status: legacyStatus as ActiveDailyStatus,
          displayPhase,
          statusLabel,
          sent: metrics.sent,
          total: metrics.total,
          gamesCount: metrics.available,
          countdownLabel:
            displayPhase === "finalizado"
              ? "Encerrado"
              : displayPhase === "pendentes" && legacyStatus === "aguardando"
                ? "Início em"
                : "Fecha em",
          countdownTargetMs: displayPhase === "finalizado" ? null : closeAt,
          position: metrics.position,
          points: metrics.points,
          participantCount: participantsByBolao.extra,
        };
      }

      const baseName =
        safeComp > 0
          ? resolveExtraBolaoDisplayName(safeComp, competitionLabels[safeComp])
          : "Bolão extra";
      const isSkaleIntegral = isSkaleBolaoCompetition(safeComp);
      const roundNum = isSkaleIntegral
        ? null
        : (effectiveExtraRoundByTicketId.get(ticket.id) ?? null);
      const roundLabel = isSkaleIntegral ? "Copa inteira" : formatExtraRoundLabel(roundNum);
      const title = isSkaleIntegral
        ? baseName
        : safeComp > 0
          ? extraBolaoTitleForPaidTicket(
              safeComp,
              baseName,
              roundNum,
              extraRounds,
            )
          : baseName;
      const scopeMatches = scopeMatchesForPaidTicket(ticket, matches, scopeOpts);
      const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
        ticket,
        metrics,
        matches,
        predictionMatchIds,
        scopeOpts,
      );
      const closeScopeMatches =
        displayPhase === "finalizado"
          ? []
          : metrics.available === 0 && predictionMatchIds.length > 0
            ? matchEntriesFromPredictions(ticket, matches, predictionMatchIds)
            : scopeMatches;
      const closeAt = nextLockMs(
        closeScopeMatches.filter((m) => isOpenMatch(m, PALPITE_LOCK_MS_EXTRA)),
        PALPITE_LOCK_MS_EXTRA,
      );
      const legacyStatus =
        displayPhase === "finalizado"
          ? "usado"
          : displayPhase === "pendentes"
            ? "aguardando"
            : "ativo";
      return {
        id: ticket.id,
        type: "extra",
        championshipId: safeComp > 0 ? safeComp : undefined,
        title,
        extraRoundNumber: roundNum,
        extraRoundLabel: roundLabel,
        cotaLabel: cotaLabelForTicket(ticket, cotaOrdinalByTicketId),
        href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
        status: legacyStatus as ActiveDailyStatus,
        displayPhase,
        statusLabel,
        sent: metrics.sent,
        total: metrics.total,
        gamesCount: metrics.available,
        countdownLabel:
          displayPhase === "finalizado"
            ? "Encerrado"
            : displayPhase === "pendentes" && legacyStatus === "aguardando"
              ? "Início em"
              : "Fecha em",
        countdownTargetMs: displayPhase === "finalizado" ? null : closeAt,
        position: metrics.position,
        points: metrics.points,
        participantCount: participantsByBolao.extra,
        isPromoBonus: ticket.isPromoBonus === true,
      };
    }

    const editionMeta =
      ticket.dailyEditionNumber != null
        ? getDailyEdition(ticket.dailyEditionNumber)
        : null;
    const editionDates = editionMeta?.datesBR ?? [ticket.playDate || playableDate];
    const dateMatches = Array.from(matches.values()).filter((match) =>
      matchInDailyEditionPool(
        match,
        ticket.dailyEditionNumber,
        editionDates,
        mainComp,
      ),
    );
    const closeAt = nextLockMs(
      dateMatches.filter((match) => isOpenMatch(match, PALPITE_LOCK_MS_DIARIO)),
      PALPITE_LOCK_MS_DIARIO,
    );
    const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
      ticket,
      metrics,
      matches,
      predictionMatchIds,
    );
    const legacyStatus =
      displayPhase === "finalizado"
        ? "usado"
        : displayPhase === "pendentes"
          ? "aguardando"
          : "ativo";
    const dailyTitle =
      ticket.dailyEditionNumber != null
        ? dailyEditionCardTitle(ticket.dailyEditionNumber)
        : "Bolão do Dia";
    const dailyEditionDatesLabel = editionMeta
      ? formatDailyEditionCardSubtitle(editionMeta)
      : null;
    return {
      id: ticket.id,
      type: "diario",
      title: dailyTitle,
      dailyEditionDatesLabel,
      cotaLabel: cotaLabelForTicket(ticket, cotaOrdinalByTicketId),
      href: `/palpites?${new URLSearchParams({ ticket: ticket.id }).toString()}`,
      status: legacyStatus as ActiveDailyStatus,
      displayPhase,
      statusLabel,
      sent: metrics.sent,
      total: metrics.total,
      gamesCount: metrics.available,
      countdownLabel:
        displayPhase === "finalizado"
          ? "Encerrado"
          : displayPhase === "pendentes" && legacyStatus === "aguardando"
            ? "Início em"
            : "Fecha em",
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
          const principalPredMatchIds = (predictionsByTicket.get(firstGeneral.id) ?? [])
            .map((p) => Number(p.match_id))
            .filter((id): id is number => Number.isFinite(id));
          const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
            firstGeneral,
            metrics,
            matches,
            principalPredMatchIds,
          );
          return {
            id: firstGeneral.id,
            title: "Bolão do Milhão",
            cotaLabel: cotaLabelForTicket(firstGeneral, cotaOrdinalByTicketId),
            href: `/palpites?${new URLSearchParams({ ticket: firstGeneral.id }).toString()}`,
            status: (displayPhase === "finalizado" ? "usado" : "ativo") as "ativo",
            displayPhase,
            statusLabel,
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
          const editionMeta =
            firstDaily.dailyEditionNumber != null
              ? getDailyEdition(firstDaily.dailyEditionNumber)
              : null;
          const editionDates = editionMeta?.datesBR ?? [firstDaily.playDate || playableDate];
          const dateMatches = Array.from(matches.values()).filter((match) =>
            matchInDailyEditionPool(
              match,
              firstDaily.dailyEditionNumber,
              editionDates,
              mainComp,
            ),
          );
          const closeAt = nextLockMs(
            dateMatches.filter((match) => isOpenMatch(match, PALPITE_LOCK_MS_DIARIO)),
            PALPITE_LOCK_MS_DIARIO,
          );
          const dailyPredMatchIds = (predictionsByTicket.get(firstDaily.id) ?? [])
            .map((p) => Number(p.match_id))
            .filter((id): id is number => Number.isFinite(id));
          const { displayPhase, statusLabel } = bolaoStatusFromMetrics(
            firstDaily,
            metrics,
            matches,
            dailyPredMatchIds,
          );
          const legacyStatus =
            displayPhase === "finalizado"
              ? "usado"
              : displayPhase === "pendentes"
                ? "aguardando"
                : "ativo";
          const dailyTitle =
            firstDaily.dailyEditionNumber != null
              ? dailyEditionCardTitle(firstDaily.dailyEditionNumber)
              : "Bolão do Dia";
          const dailyEditionDatesLabel = editionMeta
            ? formatDailyEditionCardSubtitle(editionMeta)
            : null;
          return {
            id: firstDaily.id,
            title: dailyTitle,
            dailyEditionDatesLabel,
            cotaLabel: cotaLabelForTicket(firstDaily, cotaOrdinalByTicketId),
            href: `/palpites?${new URLSearchParams({ ticket: firstDaily.id }).toString()}`,
            status: legacyStatus as ActiveDailyStatus,
            displayPhase,
            statusLabel,
            gamesCount: dateMatches.length,
            countdownLabel:
              displayPhase === "finalizado"
                ? "Encerrado"
                : displayPhase === "pendentes" && legacyStatus === "aguardando"
                  ? "Início em"
                  : "Fecha em",
            countdownTargetMs: closeAt,
            position: metrics.position,
            points: metrics.points,
          };
        })()
      : null,
    all: allActive,
  };

  const skaleDailyShopEdition = isSkaleDailyBolaoEnabled()
    ? resolveShopDailyEdition(
        listGroupStageDailyEditions().map((edition) => ({
          number: edition.number,
          label: skaleDailyEditionCardTitle(edition.number),
          datesLabel: formatDailyEditionCardSubtitle(edition),
          datesBR: edition.datesBR,
          status: resolveDailyEditionStatus(edition.number, matches, mainComp),
          purchaseOpen:
            resolveDailyEditionStatus(edition.number, matches, mainComp) !==
            "encerrado",
        })),
      )
    : null;
  const skaleDailyEditionDates = skaleDailyShopEdition
    ? getDailyEdition(skaleDailyShopEdition.number)?.datesBR ?? []
    : [];
  const skaleDailyMatchesCount = skaleDailyEditionDates.length
    ? Array.from(matches.values()).filter(
        (match) =>
          match.dateBR != null &&
          skaleDailyEditionDates.includes(match.dateBR) &&
          isOpenMatch(match, PALPITE_LOCK_MS_DIARIO) &&
          (Number(match.competitionId) === getSkaleDailyBolaoCompetitionId() ||
            (Number(match.competitionId) || mainComp) === mainComp),
      ).length
    : 0;
  const skaleDailyCloseAtMs = skaleDailyEditionDates.length
    ? nextLockMs(
        Array.from(matches.values()).filter(
          (match) =>
            match.dateBR != null &&
            skaleDailyEditionDates.includes(match.dateBR) &&
            isOpenMatch(match, PALPITE_LOCK_MS_DIARIO) &&
            (Number(match.competitionId) === getSkaleDailyBolaoCompetitionId() ||
              (Number(match.competitionId) || mainComp) === mainComp),
        ),
        PALPITE_LOCK_MS_DIARIO,
      )
    : null;

  const data: BoloesScreenData = {
    participantsByBolao: {
      ...participantsByBolao,
      artilheiros: artilheirosParticipants,
    },
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
      ...(isSkaleDailyBolaoEnabled() && skaleDailyShopEdition
        ? {
            skaleDaily: {
              href: "/tickets?bolao=skale-diario",
              gamesCount: skaleDailyMatchesCount,
              closesAtMs: skaleDailyCloseAtMs,
              priceLabel: formatBRL(getSkaleDailyBolaoUnitCents()),
            },
          }
        : {}),
      principal: {
        href: "/tickets",
        priceLabel: formatBRL(getTicketPriceCents("general")),
        closesAtMs: generalCloseAtMs,
      },
      ...(isArtilheirosBolaoEnabled()
        ? {
            artilheiros: {
              href: "/tickets?bolao=artilheiros",
              priceLabel: formatBRL(getArtilheirosTicketPriceCents()),
              participantCount: artilheirosParticipants,
            },
          }
        : {}),
      extras: configuredExtraIds
        .filter((championshipId) => !isSkaleDailyBolaoCompetition(championshipId))
        .map((championshipId) => {
        const roundInfo = extraRounds[championshipId];
        const scopeMatches =
          roundInfo != null
            ? Array.from(matches.values()).filter(
                (m) =>
                  (Number(m.competitionId) || championshipId) === championshipId &&
                  Number(m.rodada) === roundInfo.roundNumber,
              )
            : Array.from(matches.values()).filter((m) => {
                const pd = resolveDiarioPlayableDate(matches, {
                  competitionId: championshipId,
                });
                return (
                  m.dateBR === pd &&
                  (Number(m.competitionId) || championshipId) === championshipId
                );
              });
        const openOnDate = scopeMatches.filter((m) =>
          isOpenMatch(m, PALPITE_LOCK_MS_EXTRA),
        );
        const baseName = resolveExtraBolaoDisplayName(
          championshipId,
          competitionLabels[championshipId],
        );
        return {
          championshipId,
          title: extraBolaoTitleForPaidTicket(
            championshipId,
            baseName,
            undefined,
            extraRounds,
          ),
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

/**
 * Carrega os dados (lentos — banco remoto) e renderiza a tela. Fica isolado
 * num componente async para que a página possa STREAMAR: o shell + skeleton
 * aparecem na hora e este conteúdo entra quando os dados resolvem.
 */
async function BoloesData({
  userId,
  ticketsExtraOnly,
  ticketsHideDaily,
}: {
  userId: string;
  ticketsExtraOnly: boolean;
  ticketsHideDaily: boolean;
}) {
  const data = await loadBoloesData(userId).catch((err) => {
    console.error("[boloes] failed to load screen data", err);
    return null;
  });
  return (
    <BoloesClient
      data={data}
      ticketsExtraOnly={ticketsExtraOnly}
      ticketsHideDaily={ticketsHideDaily}
    />
  );
}

export default async function BoloesPage() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;
  debugBoloes("request", { hasToken: Boolean(token), userId });
  const { ticketsExtraOnly, ticketsHideDaily } = getTicketShopFlags();
  if (!userId) {
    debugBoloes("no authenticated user", {});
    return (
      <BoloesClient
        data={null}
        ticketsExtraOnly={ticketsExtraOnly}
        ticketsHideDaily={ticketsHideDaily}
      />
    );
  }
  return (
    <>
      <Suspense fallback={null}>
        <BoloesPurchaseSync />
      </Suspense>
      <Suspense fallback={<BoloesLoadingSkeleton />}>
        <BoloesData
          userId={userId}
          ticketsExtraOnly={ticketsExtraOnly}
          ticketsHideDaily={ticketsHideDaily}
        />
      </Suspense>
    </>
  );
}
