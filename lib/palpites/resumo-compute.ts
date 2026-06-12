import { fetchMatchesMap } from "@/lib/football-api";
import {
  ensureSkaleBolaoMatchesMirrored,
  resolveBolaoMatchFromMap,
  skaleCompetitionIdsForMatchMap,
} from "@/lib/boloes/skale-match-resolve";
import { listPredictions } from "@/lib/predictions";
import { dedupeLatestPredictions, scorePredictionAgainstMatch } from "@/lib/predictions/score-aggregate";
import {
  filterPredictionsForExtraTicketRound,
  resolveExtraTicketRoundScope,
} from "@/lib/palpites/extra-ticket-round-scope";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { fetchExtraChampionshipIdByTicketIds } from "@/lib/ticket-competition-server";

export type PalpitesResumo = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

export async function computePalpitesResumo(
  userId: string,
  params: { ticketId?: string; bolaoType?: "principal" | "diario" | "extra" }
): Promise<PalpitesResumo> {
  const ticketId = params.ticketId?.trim() || undefined;
  let bolaoType: "principal" | "diario" | "extra" | undefined = params.bolaoType;
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (!inferred) {
      return { palpites: 0, acertos: 0, pontos: 0, exatos: 0 };
    }
    if (inferred === "artilheiros") {
      const { getArtilheiroTicketScore } = await import("@/lib/artilheiros/ranking");
      const { listArtilheiroPicksForTicket } = await import("@/lib/artilheiros/picks");
      const [score, picks] = await Promise.all([
        ticketId ? getArtilheiroTicketScore(ticketId) : Promise.resolve(null),
        ticketId ? listArtilheiroPicksForTicket(ticketId) : Promise.resolve([]),
      ]);
      return {
        palpites: picks.length,
        acertos: 0,
        pontos: score?.totalPoints ?? 0,
        exatos: 0,
      };
    }
    bolaoType = inferred;
  }

  const [predsRaw, matches] = await Promise.all([
    listPredictions({ userId, bolaoType, ticketId }),
    (async () => {
      await ensureSkaleBolaoMatchesMirrored();
      return fetchMatchesMap({ ensureCompetitionIds: skaleCompetitionIdsForMatchMap() });
    })(),
  ]);

  let preds = predsRaw;
  if (bolaoType === "extra" && ticketId) {
    const roundScope = await resolveExtraTicketRoundScope(ticketId);
    if (roundScope) {
      preds = filterPredictionsForExtraTicketRound(preds, roundScope, matches);
    }
  }

  const mainComp = getFootballMainCompetitionId();
  const extraMap = await fetchExtraChampionshipIdByTicketIds(
    [...new Set(preds.filter((p) => p.bolao_type === "extra").map((p) => p.ticket_id))],
  );

  let palpites = 0;
  let acertos = 0;
  let pontos = 0;
  let exatos = 0;

  const deduped = dedupeLatestPredictions(
    preds.map((row) => ({
      ticket_id: row.ticket_id,
      match_id: row.match_id,
      score_casa: row.score_casa,
      score_visitante: row.score_visitante,
      submitted_at: row.submitted_at,
    })),
  );
  const bolaoByTicket = new Map(preds.map((row) => [row.ticket_id, row.bolao_type]));

  for (const p of deduped) {
    palpites += 1;
    const matchId = Number(p.match_id);
    if (!Number.isFinite(matchId)) continue;
    const bolao = bolaoByTicket.get(p.ticket_id);
    const comp = bolao === "extra" ? extraMap.get(p.ticket_id) ?? null : mainComp;
    if (comp == null || !Number.isFinite(comp) || comp <= 0) continue;
    const m = resolveBolaoMatchFromMap(matches, comp, matchId);
    if (!m) continue;
    const calc = scorePredictionAgainstMatch(p, m);
    if (calc == null) continue;
    pontos += calc.points;
    acertos += calc.outcomeHit ? 1 : 0;
    exatos += calc.exact ? 1 : 0;
  }

  return { palpites, acertos, pontos, exatos };
}
