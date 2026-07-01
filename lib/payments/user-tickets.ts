import {
  formatDailyEditionDatesLabel,
  getDailyEdition,
  getDailyEditionDatesSet,
  isMatchInDailyEditionScope,
  paidTicketDailyEditionNumber,
} from "@/lib/boloes/daily-editions";
import { inferDailyEditionFromMatchIds } from "@/lib/boloes/daily-editions-server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isSkaleBolaoCompetition, getSkaleBolaoSourceCopaCompetitionId, SKALE_BOLAO_SCOPE_LABEL } from "@/lib/boloes/skale-config";
import {
  isSkaleDailyBolaoCompetition,
  paidTicketSkaleDailyEditionNumber,
  SKALE_DAILY_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/skale-daily-config";
import {
  ensureSkaleBolaoMatchesMirrored,
  resolveBolaoMatchFromMap,
  skaleCompetitionIdsForMatchMap,
} from "@/lib/boloes/skale-match-resolve";
import { isBolaoScopeRoundComplete } from "@/lib/boloes/display-status";
import {
  bolaoPhaseScopeForPaidTicket,
  bolaoPhaseScopeFromPredictions,
  paidTicketExtraRoundNumber,
} from "@/lib/boloes/ticket-match-scope";
import { getPool } from "@/lib/db";
import { brToday, minBrDate, resolveDiarioPlayableDate, utcMsForBrDate } from "@/lib/diario-playable-date";
import { fetchMatchesMap, type MatchMap } from "@/lib/football-api";
import { listPredictionTicketMatchPairsForUser, palpiteLockBeforeKickoffMs } from "@/lib/predictions";
import { effectiveExtraRoundForPaidTicket } from "@/lib/ticket-shop-extra-display";
import { extraBolaoCurrentRoundsByChampionship } from "@/lib/ticket-shop-extra-rounds";
import { getBolaoDefinitionsByIds } from "@/lib/boloes/definitions/repository";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { scopeMatchesForPaidTicket } from "@/lib/boloes/ticket-match-scope";

export type PaidTicketRow = {
  id: string;
  ticketType: "general" | "daily" | "extra" | "artilheiros";
  quantity: number;
  paidAt: string | null;
  createdAt: string;
  extraChampionshipId?: number | null;
  /** Bolão extra por rodada (`tickets.round_number`). */
  extraRoundNumber?: number | null;
  /** Bolão diário por edição (`tickets.round_number` = 1–4). */
  dailyEditionNumber?: number | null;
  /** Bolão diário Skale — mesma semântica de edição em `round_number`. */
  skaleDailyEditionNumber?: number | null;
  /** Definição admin vinculada à cota. */
  bolaoDefinitionId?: string | null;
  bolaoDefinition?: BolaoDefinition | null;
  isPromoBonus?: boolean;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  playDate?: string | null;
  availableGames?: number;
  /** Palpites já enviados nesta cota. */
  palpitesCount?: number;
};

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

function parseKickoffUtcMs(dateBR?: string, hourBR?: string): number | null {
  if (!dateBR) return null;
  const [d, m, y] = String(dateBR).split("/");
  if (!d || !m || !y) return null;
  const [hh, mm] = String(hourBR || "00:00").split(":");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const hours = Number(hh || 0);
  const minutes = Number(mm || 0);
  if (![day, month, year, hours, minutes].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0);
}

type OpenMatch = {
  matchId: number;
  dateBR: string;
  status: string;
  competitionId: number;
  kickoffAt: number | null;
};

function dedupeOpenMatchesById(matches: OpenMatch[]): OpenMatch[] {
  const seen = new Set<number>();
  const out: OpenMatch[] = [];
  for (const m of matches) {
    if (seen.has(m.matchId)) continue;
    seen.add(m.matchId);
    out.push(m);
  }
  return out;
}

/** Tickets com pagamento confirmado (origem do banco — fonte de verdade). */
export async function listPaidTicketsForUser(
  userId: string,
  opts?: { matchMap?: MatchMap },
): Promise<PaidTicketRow[]> {
  await ensureBolaoDefinitionsSchema().catch(() => undefined);
  const pool = getPool();
  const mainComp = getFootballMainCompetitionId();
  try {
    const preloadedMatchMap = opts?.matchMap;
    const { rows } = await pool.query<{
      id: string;
      ticket_type: "general" | "daily" | "extra" | "artilheiros";
      extra_championship_id: number | null;
      round_number: number | null;
      bolao_definition_id: string | null;
      is_promo_bonus: boolean;
      total_amount_cents: number | null;
      quantity: number;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, ticket_type, extra_championship_id, round_number, bolao_definition_id,
              COALESCE(is_promo_bonus, false) AS is_promo_bonus,
              COALESCE(total_amount_cents, 0) AS total_amount_cents,
              quantity, paid_at, created_at
       FROM tickets
       WHERE user_id = $1 AND status = 'paid'
       ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST, created_at DESC`,
      [userId],
    );

    const definitionIds = [
      ...new Set(
        rows
          .map((r) => r.bolao_definition_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const definitions = await getBolaoDefinitionsByIds(definitionIds).catch(() => []);
    const definitionById = new Map(definitions.map((d) => [d.id, d]));

    const hasSkaleTicket = rows.some(
      (r) =>
        r.ticket_type === "extra" &&
        (isSkaleBolaoCompetition(Number(r.extra_championship_id)) ||
          isSkaleDailyBolaoCompetition(Number(r.extra_championship_id))),
    );
    if (hasSkaleTicket) {
      await ensureSkaleBolaoMatchesMirrored();
    }

    const extraCompIds = [
      ...new Set(
        rows
          .filter((r) => r.ticket_type === "extra" && r.extra_championship_id != null)
          .map((r) => Number(r.extra_championship_id))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ];

    const [matchMap, preds, liveExtraRounds] = await Promise.all([
      preloadedMatchMap != null
        ? Promise.resolve(preloadedMatchMap)
        : fetchMatchesMap({
            ensureCompetitionIds: [
              ...extraCompIds,
              ...skaleCompetitionIdsForMatchMap(),
            ],
          }).catch(() => new Map() as MatchMap),
      listPredictionTicketMatchPairsForUser(userId).catch(
        () => [] as { ticket_id: string; match_id: number }[],
      ),
      extraCompIds.length > 0
        ? extraBolaoCurrentRoundsByChampionship(extraCompIds).catch(
            () => ({}) as Record<number, { roundNumber: number }>,
          )
        : Promise.resolve({} as Record<number, { roundNumber: number }>),
    ]);

    const mapped = rows.map((r) => {
      const compId = r.ticket_type === "extra" ? r.extra_championship_id : null;
      const compNum =
        compId != null && Number.isFinite(Number(compId)) ? Number(compId) : 0;
      const extraRoundNumber: number | null =
        r.ticket_type === "extra" &&
        compNum > 0 &&
        !isSkaleBolaoCompetition(compNum) &&
        !isSkaleDailyBolaoCompetition(compNum)
          ? effectiveExtraRoundForPaidTicket({
              championshipId: compNum,
              roundNumberFromDb:
                r.round_number != null &&
                Number.isFinite(Number(r.round_number)) &&
                Number(r.round_number) > 0
                  ? Math.trunc(Number(r.round_number))
                  : null,
              liveRoundNumber: liveExtraRounds[compNum]?.roundNumber ?? null,
            })
          : null;
      const dailyEditionNumber =
        r.ticket_type === "daily" ? paidTicketDailyEditionNumber({ ticketType: "daily", round_number: r.round_number }) : null;
      const skaleDailyEditionNumber =
        r.ticket_type === "extra" && isSkaleDailyBolaoCompetition(compNum)
          ? paidTicketSkaleDailyEditionNumber({
              ticketType: "extra",
              extraChampionshipId: compNum,
              round_number: r.round_number,
            })
          : null;
      return {
        id: r.id,
        ticketType: r.ticket_type,
        extraChampionshipId: compId,
        extraRoundNumber,
        dailyEditionNumber,
        skaleDailyEditionNumber,
        bolaoDefinitionId: r.bolao_definition_id,
        bolaoDefinition: r.bolao_definition_id
          ? definitionById.get(r.bolao_definition_id) ?? null
          : null,
        isPromoBonus:
          Boolean(r.is_promo_bonus) ||
          (r.ticket_type === "extra" && Number(r.total_amount_cents ?? 0) === 0),
        quantity: Math.max(1, r.quantity),
        paidAt: r.paid_at ? r.paid_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
      };
    });
    if (!matchMap.size) {
      return mapped.map((t) => ({
        ...t,
        dailyStatus:
          t.ticketType === "daily" || t.ticketType === "extra" ? ("disponivel" as const) : undefined,
        playDate: t.ticketType === "daily" || t.ticketType === "extra" ? brToday() : undefined,
        availableGames: 0,
        palpitesCount: 0,
      }));
    }

    const now = Date.now();
    const today = brToday();
    const todayMs = utcMsForBrDate(today) ?? now;

    const buildOpenMatches = (leadMs: number): OpenMatch[] =>
      Array.from(matchMap.values())
        .map((m) => ({
          matchId: m.id,
          dateBR: m.dateBR,
          status: m.status,
          competitionId: Number(m.competitionId) || mainComp,
          kickoffAt: parseKickoffUtcMs(m.dateBR, m.hour),
        }))
        .filter((m) => {
          const finished = isFinishedStatus(m.status);
          const lockAt = m.kickoffAt != null ? m.kickoffAt - leadMs : null;
          const dateMs = m.dateBR ? utcMsForBrDate(m.dateBR) : null;
          const stillOpenByTime = lockAt != null ? lockAt > now : (dateMs ?? 0) >= todayMs;
          return !finished && stillOpenByTime;
        });

    const openMatchesPrincipalLock = buildOpenMatches(
      palpiteLockBeforeKickoffMs("principal"),
    );
    const openMatchesDiarioLock = buildOpenMatches(palpiteLockBeforeKickoffMs("diario"));
    const openMatchesExtraLock = buildOpenMatches(palpiteLockBeforeKickoffMs("extra"));

    const byTicket = new Map<string, { ticket_id: string; match_id: number }[]>();
    for (const p of preds) {
      const arr = byTicket.get(p.ticket_id) ?? [];
      arr.push(p);
      byTicket.set(p.ticket_id, arr);
    }

    const { rows: artPickRows } = await pool.query<{ ticket_id: string; cnt: string }>(
      `SELECT ticket_id::text AS ticket_id, COUNT(*)::text AS cnt
       FROM artilheiro_picks
       WHERE ticket_id IN (
         SELECT id FROM tickets WHERE user_id = $1 AND ticket_type = 'artilheiros' AND status = 'paid'
       )
       GROUP BY ticket_id`,
      [userId],
    ).catch(() => ({ rows: [] as { ticket_id: string; cnt: string }[] }));
    const artPicksByTicket = new Map(
      artPickRows.map((r) => [r.ticket_id, Number(r.cnt) || 0]),
    );

    const result = mapped.map((t) => {
      const ticketPreds = byTicket.get(t.id) ?? [];
      const palpitesCount = ticketPreds.length;

      if (t.ticketType === "artilheiros") {
        const picksCount = artPicksByTicket.get(t.id) ?? 0;
        return {
          ...t,
          palpitesCount: picksCount,
          availableGames: Math.max(0, 3 - picksCount),
          dailyStatus: (picksCount >= 3 ? "em_uso" : "disponivel") as "disponivel" | "em_uso",
        };
      }

      if (t.bolaoDefinitionId && t.bolaoDefinition) {
        const def = t.bolaoDefinition;
        const scoped = scopeMatchesForPaidTicket(t, matchMap);
        const lockKind =
          def.ticketType === "general"
            ? "principal"
            : def.ticketType === "daily"
              ? "diario"
              : "extra";
        const leadMs = palpiteLockBeforeKickoffMs(lockKind);
        const predictedIds = new Set<number>(
          ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite),
        );
        let availableGames = 0;
        for (const m of scoped) {
          if (predictedIds.has(m.id)) continue;
          const finished = isFinishedStatus(m.status);
          const kickoff = parseKickoffUtcMs(m.dateBR, m.hour);
          const lockAt = kickoff != null ? kickoff - leadMs : null;
          const dateMs = m.dateBR ? utcMsForBrDate(m.dateBR) : null;
          const stillOpen =
            lockAt != null ? lockAt > now : (dateMs ?? 0) >= todayMs;
          if (!finished && stillOpen) availableGames++;
        }
        const dailyStatus: NonNullable<PaidTicketRow["dailyStatus"]> =
          palpitesCount === 0
            ? "disponivel"
            : availableGames === 0
              ? "usado"
              : "em_uso";
        const playDate =
          def.scopeDates[0] ??
          scoped.find((m) => m.dateBR)?.dateBR ??
          null;
        return {
          ...t,
          dailyStatus,
          playDate,
          availableGames,
          palpitesCount,
        };
      }

      if (t.ticketType === "general") {
        const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
        const openMain = openMatchesPrincipalLock.filter((m) => m.competitionId === mainComp);
        const availableGames = openMain.reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
        return { ...t, availableGames, palpitesCount };
      }

      const scopeComp = t.ticketType === "daily" ? mainComp : Number(t.extraChampionshipId);
      if (!Number.isFinite(scopeComp) || scopeComp <= 0) {
        return { ...t, dailyStatus: "disponivel" as const, playDate: brToday(), availableGames: 0 };
      }

      /** Bolão Skale integral = Copa inteira (não diário por edição). */
      if (
        t.ticketType === "extra" &&
        isSkaleBolaoCompetition(scopeComp) &&
        !isSkaleDailyBolaoCompetition(scopeComp)
      ) {
        const copaId = getSkaleBolaoSourceCopaCompetitionId();
        const skaleScopeOpen = dedupeOpenMatchesById(
          openMatchesExtraLock.filter(
            (m) => m.competitionId === scopeComp || m.competitionId === copaId,
          ),
        );
        const predictedIds = new Set<number>(
          ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite),
        );
        const availableGames = skaleScopeOpen.reduce(
          (acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1),
          0,
        );
        const dailyStatus: NonNullable<PaidTicketRow["dailyStatus"]> =
          palpitesCount === 0
            ? "disponivel"
            : availableGames === 0
              ? "usado"
              : "em_uso";
        return {
          ...t,
          dailyStatus,
          playDate: SKALE_BOLAO_SCOPE_LABEL,
          availableGames,
          palpitesCount,
        };
      }

      const scopeOpenRaw =
        t.ticketType === "daily"
          ? openMatchesDiarioLock.filter((m) => m.competitionId === scopeComp)
          : openMatchesExtraLock.filter(
              (m) =>
                m.competitionId === scopeComp ||
                (isSkaleDailyBolaoCompetition(scopeComp) &&
                  m.competitionId === getSkaleBolaoSourceCopaCompetitionId()),
            );
      const scopeOpen = isSkaleDailyBolaoCompetition(scopeComp)
        ? dedupeOpenMatchesById(scopeOpenRaw)
        : scopeOpenRaw;
      const playableDate = resolveDiarioPlayableDate(matchMap, { competitionId: scopeComp });
      const extraRound = paidTicketExtraRoundNumber(t);

      const dailyEdition =
        t.ticketType === "daily"
          ? paidTicketDailyEditionNumber(t)
          : isSkaleDailyBolaoCompetition(scopeComp)
            ? paidTicketSkaleDailyEditionNumber(t)
            : null;
      const dailyEditionDates =
        dailyEdition != null ? getDailyEditionDatesSet(dailyEdition) : null;

      const openInTicketScope = (om: OpenMatch): boolean => {
        if (
          isSkaleBolaoCompetition(scopeComp) &&
          !isSkaleDailyBolaoCompetition(scopeComp)
        ) {
          const copaId = getSkaleBolaoSourceCopaCompetitionId();
          return om.competitionId === scopeComp || om.competitionId === copaId;
        }
        if (dailyEdition != null && t.ticketType === "daily") {
          return isMatchInDailyEditionScope(
            {
              dateBR: om.dateBR,
              kickoffAt:
                om.kickoffAt != null
                  ? new Date(om.kickoffAt).toISOString()
                  : null,
            },
            dailyEdition,
          );
        }
        if (dailyEditionDates != null) {
          return om.dateBR != null && dailyEditionDates.has(om.dateBR);
        }
        if (extraRound == null) return om.dateBR === playableDate;
        const m = resolveBolaoMatchFromMap(matchMap, scopeComp, om.matchId);
        return m != null && Number(m.rodada) === extraRound;
      };

      if (palpitesCount === 0) {
        const availableGames = scopeOpen.filter(openInTicketScope).length;
        const editionPlayDate =
          dailyEditionDates != null
            ? [...dailyEditionDates].sort(
                (a, b) => (utcMsForBrDate(a) ?? 0) - (utcMsForBrDate(b) ?? 0),
              )[0] ?? playableDate
            : playableDate;
        return {
          ...t,
          dailyStatus: "disponivel" as const,
          playDate: editionPlayDate,
          availableGames,
          palpitesCount: 0,
        };
      }

      const predictedIds = new Set<number>(ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite));
      const matchDates = new Set<string>();
      for (const p of ticketPreds) {
        const m = resolveBolaoMatchFromMap(matchMap, scopeComp, Number(p.match_id));
        if (m?.dateBR) matchDates.add(m.dateBR);
      }

      const predMatchIds = ticketPreds.map((p) => Number(p.match_id));
      const phaseScope = bolaoPhaseScopeForPaidTicket(t, matchMap, predMatchIds);
      const predOnlyScope = bolaoPhaseScopeFromPredictions(t, matchMap, predMatchIds);

      const inferredEdition =
        isSkaleBolaoCompetition(scopeComp) && !isSkaleDailyBolaoCompetition(scopeComp)
          ? null
          : dailyEdition ??
            inferDailyEditionFromMatchIds(
              ticketPreds.map((p) => Number(p.match_id)),
              matchMap,
              isSkaleDailyBolaoCompetition(scopeComp)
                ? getSkaleBolaoSourceCopaCompetitionId()
                : scopeComp,
            );
      const predDate = minBrDate(matchDates);
      const editionMeta = inferredEdition != null ? getDailyEdition(inferredEdition) : null;
      const targetDate =
        isSkaleBolaoCompetition(scopeComp) && !isSkaleDailyBolaoCompetition(scopeComp)
          ? SKALE_BOLAO_SCOPE_LABEL
          : isSkaleDailyBolaoCompetition(scopeComp) && editionMeta != null
            ? `${SKALE_DAILY_BOLAO_DISPLAY_NAME} · ${formatDailyEditionDatesLabel(editionMeta)}`
            : editionMeta != null
              ? formatDailyEditionDatesLabel(editionMeta)
              : predDate ?? playableDate;
      const availableGames = scopeOpen
        .filter(openInTicketScope)
        .reduce((acc, m) => (predictedIds.has(m.matchId) ? acc : acc + 1), 0);
      const roundDone = isBolaoScopeRoundComplete(phaseScope, now);
      const userGamesDone =
        predOnlyScope.length > 0 && isBolaoScopeRoundComplete(predOnlyScope, now);
      const dailyStatus: NonNullable<PaidTicketRow["dailyStatus"]> =
        roundDone || (palpitesCount > 0 && availableGames === 0 && userGamesDone)
          ? "usado"
          : "em_uso";
      return { ...t, dailyStatus, playDate: targetDate, availableGames, palpitesCount };
    });
    return result;
  } catch (e) {
    console.error("[user-tickets] listPaidTicketsForUser", e);
    return [];
  }
}
