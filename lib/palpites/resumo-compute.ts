import { fetchMatchesMap, getMatchFromMap } from "@/lib/football-api";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
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
    bolaoType = inferred;
  }

  const [preds, matches] = await Promise.all([
    listPredictions({ userId, bolaoType, ticketId }),
    fetchMatchesMap(),
  ]);

  const mainComp = getFootballMainCompetitionId();
  const extraMap = await fetchExtraChampionshipIdByTicketIds(
    [...new Set(preds.filter((p) => p.bolao_type === "extra").map((p) => p.ticket_id))],
  );

  let palpites = 0;
  let acertos = 0;
  let pontos = 0;
  let exatos = 0;

  for (const p of preds) {
    palpites += 1;
    const matchId = Number(p.match_id);
    if (!Number.isFinite(matchId)) continue;
    const comp = p.bolao_type === "extra" ? extraMap.get(p.ticket_id) ?? null : mainComp;
    if (comp == null || !Number.isFinite(comp) || comp <= 0) continue;
    const m = getMatchFromMap(matches, comp, matchId);
    if (!m || m.resultCasa == null || m.resultVisitante == null) continue;
    const calc = calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa, m.resultVisitante);
    pontos += calc.points;
    acertos += calc.outcomeHit ? 1 : 0;
    exatos += calc.exact ? 1 : 0;
  }

  return { palpites, acertos, pontos, exatos };
}
