import {
  fetchMatchesMapDirectFromDb,
  type MatchMap,
} from "@/lib/football-api";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isFullCopaMirrorBolao } from "@/lib/boloes/skale-match-resolve";
import { isSkaleDailyBolaoCompetition } from "@/lib/boloes/skale-daily-config";
import { resolveEffectiveExtraRoundForTicket } from "@/lib/football/extras-rodada";
import type { PredictionBolaoType } from "@/lib/palpites-kickoff-lock";
import { resolveOwnedTicketMeta } from "@/lib/palpites/ticket-meta";

export type PalpiteSaveContext = {
  userId: string;
  ticketId: string;
  bolaoType: PredictionBolaoType;
  extraChampionshipId: number | null;
  extraRoundNumber: number | null;
  dailyEditionNumber: number | null;
  bolaoDefinitionId: string | null;
  bolaoDefinition: import("@/lib/boloes/definitions/types").BolaoDefinition | null;
  matchMap: MatchMap;
  mainComp: number;
  scopedComp: number;
};

export async function buildPalpiteSaveContext(
  userId: string,
  ticketId: string,
): Promise<
  | { ok: true; ctx: PalpiteSaveContext }
  | { ok: false; error: string; status: number }
> {
  const meta = await resolveOwnedTicketMeta(userId, ticketId);
  if (!meta) {
    return { ok: false, error: "Ticket invalido", status: 400 };
  }

  const bolaoType = meta.bolao;
  const extraChampionshipId = meta.extraChampionshipId;
  let extraRoundNumber = meta.extraRoundNumber;
  const dailyEditionNumber = meta.dailyEditionNumber;

  if (
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    Number.isFinite(extraChampionshipId) &&
    extraChampionshipId > 0 &&
    !isFullCopaMirrorBolao(extraChampionshipId) &&
    !isSkaleDailyBolaoCompetition(extraChampionshipId)
  ) {
    try {
      const resolved = await resolveEffectiveExtraRoundForTicket(
        extraChampionshipId,
        extraRoundNumber,
      );
      if (
        resolved?.rodada != null &&
        Number.isFinite(resolved.rodada) &&
        resolved.rodada > 0
      ) {
        extraRoundNumber = resolved.rodada;
      }
    } catch {
      // sem rodada atual — extra legado por dia
    }
  }

  const matchMap = await fetchMatchesMapDirectFromDb();
  const mainComp = getFootballMainCompetitionId();
  const scopedComp =
    meta.bolaoDefinition != null
      ? meta.bolaoDefinition.competitionId
      : bolaoType === "extra" &&
          extraChampionshipId != null &&
          Number.isFinite(Number(extraChampionshipId)) &&
          Number(extraChampionshipId) > 0
        ? Number(extraChampionshipId)
        : mainComp;

  return {
    ok: true,
    ctx: {
      userId,
      ticketId,
      bolaoType,
      extraChampionshipId,
      extraRoundNumber,
      dailyEditionNumber,
      bolaoDefinitionId: meta.bolaoDefinitionId,
      bolaoDefinition: meta.bolaoDefinition,
      matchMap,
      mainComp,
      scopedComp,
    },
  };
}
