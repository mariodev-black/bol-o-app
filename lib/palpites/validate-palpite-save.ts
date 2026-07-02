import { isGroupStageFaseKey } from "@/lib/boloes/palpites-jogos-filter";
import {
  getDailyEdition,
  getDailyEditionDatesSet,
  isMatchInDailyEditionScope,
} from "@/lib/boloes/daily-editions";
import {
  inferDailyEditionFromMatchIds,
  isDailyEditionClosed,
  isDailyTicketCrossEditionConflict,
} from "@/lib/boloes/daily-editions-server";
import {
  isFullCopaMirrorBolao,
  resolveBolaoMatchFromMap,
} from "@/lib/boloes/skale-match-resolve";
import {
  isSkaleDailyBolaoCompetition,
  paidTicketSkaleDailyEditionNumber,
} from "@/lib/boloes/skale-daily-config";
import { getMatchFromMap, resolveKickoffAtIso } from "@/lib/football-api";
import type { PalpiteSaveContext } from "@/lib/palpites/palpite-save-context";
import { brToday, resolveDiarioPlayableDate, utcMsForBrDate } from "@/lib/diario-playable-date";
import {
  getPalpiteRejectReason,
  hasOfficialMatchResult,
  isMatchOpenForPalpite,
  palpiteRejectErrorMessage,
} from "@/lib/palpites-match-open";
import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { matchBelongsToBolaoDefinition } from "@/lib/boloes/definitions/scope";
import { palpiteLockBeforeKickoffMs } from "@/lib/palpites-kickoff-lock";
import {
  getPredictionByUserTicketMatch,
  listPredictions,
} from "@/lib/predictions";

export type PalpiteItemInput = {
  matchId: number;
  scoreCasa: number;
  scoreVisitante: number;
};

export async function validatePalpiteForSave(
  ctx: PalpiteSaveContext,
  data: PalpiteItemInput,
): Promise<{ error: string; status: number } | null> {
  const {
    bolaoType,
    extraChampionshipId,
    extraRoundNumber,
    dailyEditionNumber,
    matchMap,
    mainComp,
    scopedComp,
    bolaoDefinition,
  } = ctx;

  if (bolaoDefinition) {
    if (!matchBelongsToBolaoDefinition(bolaoDefinition, matchMap, data.matchId)) {
      return {
        error: `Partida fora do escopo do bolão "${bolaoDefinition.displayName}".`,
        status: 400,
      };
    }
    const match = resolveBolaoMatchFromMap(matchMap, scopedComp, data.matchId);
    if (!match) {
      return {
        error: "Partida nao encontrada no calendario oficial do bolão.",
        status: 404,
      };
    }
    const dateBrDb = String(match.dateBR || "").trim();
    if (!dateBrDb) {
      return {
        error:
          "Partida sem data no banco (matches_cache.date_br). Aguarde sincronizacao ou contate suporte.",
        status: 400,
      };
    }
    const kickoffIso = resolveKickoffAtIso({
      kickoffAt: match.kickoffAt,
      dateBR: dateBrDb,
      hour: match.hour,
    });
    const eligibility = {
      status: match.status,
      kickoffAt: kickoffIso ?? match.kickoffAt,
      resultCasa: match.resultCasa,
      resultVisitante: match.resultVisitante,
    };
    if (!isMatchOpenForPalpite(eligibility, bolaoType)) {
      const reason = getPalpiteRejectReason(eligibility, bolaoType);
      return {
        error: palpiteRejectErrorMessage(reason, bolaoType),
        status: 400,
      };
    }
    return null;
  }

  const match = resolveBolaoMatchFromMap(matchMap, scopedComp, data.matchId);
  if (!match) {
    const scope =
      bolaoType === "diario"
        ? "bolao do dia"
        : bolaoType === "extra"
          ? "bolao extra"
          : "bolao geral";
    return {
      error: `Partida nao encontrada no calendario oficial (${scope}, matches_cache / competicao do servidor). Verifique o id ou aguarde a sincronizacao.`,
      status: 404,
    };
  }
  if (bolaoType === "principal" && Number(match.competitionId) !== mainComp) {
    return {
      error:
        "Partida nao pertence ao campeonato principal (Copa). Use apenas jogos do bolao geral listados na competicao configurada.",
      status: 400,
    };
  }
  if (
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    Number(match.competitionId) !== extraChampionshipId
  ) {
    return {
      error: `Partida nao pertence ao bolao extra (campeonato ${extraChampionshipId}).`,
      status: 400,
    };
  }

  const dateBrDb = String(match.dateBR || "").trim();
  if (!dateBrDb) {
    return {
      error:
        "Partida sem data no banco (matches_cache.date_br). Nao e possivel validar o dia; aguarde sincronizacao ou contate suporte.",
      status: 400,
    };
  }

  const kickoffIso = resolveKickoffAtIso({
    kickoffAt: match.kickoffAt,
    dateBR: dateBrDb,
    hour: match.hour,
  });

  const eligibility = {
    status: match.status,
    kickoffAt: kickoffIso ?? match.kickoffAt,
    resultCasa: match.resultCasa,
    resultVisitante: match.resultVisitante,
  };
  if (!isMatchOpenForPalpite(eligibility, bolaoType)) {
    const reason = getPalpiteRejectReason(eligibility, bolaoType);
    return {
      error: palpiteRejectErrorMessage(reason, bolaoType),
      status: 400,
    };
  }

  const isFullCopaExtraPool =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    isFullCopaMirrorBolao(extraChampionshipId) &&
    !isSkaleDailyBolaoCompetition(extraChampionshipId);
  if (isFullCopaExtraPool) {
    return null;
  }

  const skaleDailyEdition =
    bolaoType === "extra" && extraChampionshipId != null
      ? paidTicketSkaleDailyEditionNumber({
          ticketType: "extra",
          extraChampionshipId,
          extraRoundNumber: extraRoundNumber,
        })
      : null;
  if (skaleDailyEdition != null && extraChampionshipId != null) {
    const scopeComp = extraChampionshipId;
    const editionDates = getDailyEditionDatesSet(skaleDailyEdition);
    const ticketPreds = await listPredictions({
      userId: ctx.userId,
      ticketId: ctx.ticketId,
      bolaoType: "extra",
    });
    if (!editionDates.has(dateBrDb)) {
      const editionMeta = getDailyEdition(skaleDailyEdition);
      return {
        error: `Ticket: esta partida nao pertence ao Bolao Diario Skale #${skaleDailyEdition} (dias ${editionMeta?.datesBR.join(", ") ?? "?"}).`,
        status: 400,
      };
    }
    if (isDailyEditionClosed(skaleDailyEdition, matchMap, mainComp)) {
      return {
        error: `Bolao Diario Skale #${skaleDailyEdition} ja encerrado para novos palpites.`,
        status: 400,
      };
    }
    if (
      ticketPreds.length > 0 &&
      isDailyTicketCrossEditionConflict(
        skaleDailyEdition,
        ticketPreds.map((p) => Number(p.match_id)),
        matchMap,
        mainComp,
      )
    ) {
      return {
        error: "Este ticket diario Skale ja foi encerrado para novo uso",
        status: 400,
      };
    }
    return null;
  }

  if (bolaoType === "extra" && extraRoundNumber != null) {
    const scopeComp = extraChampionshipId as number;
    const matchRound = Number(match.rodada ?? NaN);
    if (!Number.isFinite(matchRound) || matchRound !== extraRoundNumber) {
      return {
        error: `Ticket: esta partida não pertence à rodada ${extraRoundNumber} do bolão extra (jogo está na rodada ${Number.isFinite(matchRound) ? matchRound : "desconhecida"}).`,
        status: 400,
      };
    }
    if (Number(match.competitionId) !== scopeComp) {
      return {
        error: `Ticket: partida não pertence ao campeonato ${scopeComp} do bolão extra.`,
        status: 400,
      };
    }
    const lockLead = palpiteLockBeforeKickoffMs("extra");
    let stillOpen = false;
    for (const [, m] of matchMap) {
      if (Number(m.competitionId) !== scopeComp) continue;
      if (Number(m.rodada ?? NaN) !== extraRoundNumber) continue;
      const st = String(m.status || "").toLowerCase();
      const finished =
        st.includes("encerr") ||
        st.includes("finaliz") ||
        st.includes("cancel") ||
        st.includes("adiad") ||
        st.includes("suspens") ||
        st.includes("interromp") ||
        hasOfficialMatchResult({
          status: m.status,
          kickoffAt: m.kickoffAt,
          resultCasa: m.resultCasa,
          resultVisitante: m.resultVisitante,
        });
      const ko = m.kickoffAt ? new Date(m.kickoffAt).getTime() : null;
      const locked = ko != null && Number.isFinite(ko) && Date.now() >= ko - lockLead;
      if (!finished && !locked) {
        stillOpen = true;
        break;
      }
    }
    if (!stillOpen) {
      return {
        error: `Rodada ${extraRoundNumber} já encerrada para novos palpites.`,
        status: 400,
      };
    }
  } else if (bolaoType === "diario") {
    const ticketPreds = await listPredictions({
      userId: ctx.userId,
      ticketId: ctx.ticketId,
      bolaoType: "diario",
    });
    const lockIds = ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite);
    let edition =
      dailyEditionNumber ??
      inferDailyEditionFromMatchIds(lockIds, matchMap, mainComp);

    if (edition == null) {
      const playableDate = resolveDiarioPlayableDate(matchMap, {
        lockToMatchIds: lockIds,
        competitionId: mainComp,
      });
      if (dateBrDb !== playableDate) {
        return {
          error: `Ticket: esta partida esta no dia ${dateBrDb}; o ticket so aceita jogos do dia ${playableDate}.`,
          status: 400,
        };
      }
    } else {
      if (!isGroupStageFaseKey(match.phaseKey)) {
        return {
          error:
            "Partida nao pertence a fase de grupos do Bolao Diario. Palpites so sao aceitos em jogos da fase de grupos.",
          status: 400,
        };
      }
      if (
        !isMatchInDailyEditionScope(
          { dateBR: dateBrDb, hour: match.hour, kickoffAt: match.kickoffAt },
          edition,
        )
      ) {
        const editionMeta = getDailyEdition(edition);
        return {
          error: `Ticket: esta partida nao pertence ao ${editionMeta ? `Bolao Diario #${edition}` : "bolao diario"} (dias ${editionMeta?.datesBR.join(", ") ?? "?"}).`,
          status: 400,
        };
      }
      if (isDailyEditionClosed(edition, matchMap, mainComp)) {
        return {
          error: `Bolao Diario #${edition} ja encerrado para novos palpites.`,
          status: 400,
        };
      }
      if (
        ticketPreds.length > 0 &&
        isDailyTicketCrossEditionConflict(
          edition,
          ticketPreds.map((p) => Number(p.match_id)),
          matchMap,
          mainComp,
        )
      ) {
        return {
          error: "Este ticket diario ja foi encerrado para novo uso",
          status: 400,
        };
      }
    }
  } else if (bolaoType === "extra") {
    const today = brToday();
    const scopeComp = extraChampionshipId as number;
    const ticketPreds = await listPredictions({
      userId: ctx.userId,
      ticketId: ctx.ticketId,
      bolaoType: "extra",
    });
    const lockIds = ticketPreds.map((p) => Number(p.match_id)).filter(Number.isFinite);
    const playableDate = resolveDiarioPlayableDate(matchMap, {
      lockToMatchIds: lockIds,
      competitionId: scopeComp,
    });
    if (ticketPreds.length > 0) {
      let hasDateMismatch = false;
      let allFinished = true;
      for (const p of ticketPreds) {
        const m = getMatchFromMap(matchMap, scopeComp, Number(p.match_id));
        const date = m?.dateBR ?? null;
        if (date && date !== playableDate) hasDateMismatch = true;
        const st = String(m?.status || "").toLowerCase();
        const finished =
          !m ||
          st.includes("encerr") ||
          st.includes("finaliz") ||
          st.includes("cancel") ||
          st.includes("adiad") ||
          st.includes("suspens") ||
          st.includes("interromp") ||
          (m != null &&
            hasOfficialMatchResult({
              status: m.status,
              kickoffAt: m.kickoffAt,
              resultCasa: m.resultCasa,
              resultVisitante: m.resultVisitante,
            }));
        if (!finished) allFinished = false;
      }
      if (hasDateMismatch || allFinished) {
        return {
          error: "Este ticket extra ja foi encerrado para novo uso",
          status: 400,
        };
      }
    }
    if (dateBrDb !== playableDate) {
      return {
        error: `Ticket: esta partida esta no dia ${dateBrDb} (matches_cache); o ticket so aceita jogos do dia ${playableDate}.`,
        status: 400,
      };
    }
    const existing = await getPredictionByUserTicketMatch({
      userId: ctx.userId,
      ticketId: ctx.ticketId,
      matchId: data.matchId,
    });
    if (existing) {
      const submittedDay = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(existing.submitted_at);
      if (playableDate === today && submittedDay !== today) {
        return {
          error: "Ticket extra so permite alterar palpites criados no dia atual",
          status: 400,
        };
      }
    }
    const matchDayMs = utcMsForBrDate(dateBrDb);
    const playableDayMs = utcMsForBrDate(playableDate);
    if (matchDayMs == null || playableDayMs == null || matchDayMs !== playableDayMs) {
      return {
        error: "Ticket valido apenas para jogos do dia da rodada",
        status: 400,
      };
    }
  }

  return null;
}
