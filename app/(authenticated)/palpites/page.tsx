import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PalpitesClient, { type PalpitesInitialData } from "./PalpitesClient";
import { runSafeServerPage } from "@/lib/server/safe-server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind-shared";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
import { fetchMatchesMap } from "@/lib/football-api";
import { ensureCompetitionIdsForBolaoExtra } from "@/lib/boloes/match-cache-competition-id";
import { resolveBolaoMatchFromMap } from "@/lib/boloes/skale-match-resolve";
import { getPartidasFasesFromDb } from "@/lib/partidas-cache-payload";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import { getPool } from "@/lib/db";
import { parseKickoffFromPartidaPayload, pickScoreFromPartidaPayload } from "@/lib/partida-placar";
import { hasOfficialMatchResult } from "@/lib/palpites-match-open";
import {
  formatRankingHistoricoLiveLabel,
  isRankingHistoricoLive,
} from "@/lib/ranking/historico-display";
import { pickTabelaGruposForPalpites } from "@/lib/tabela-palpites-normalize";
import { effectiveExtraRoundForPaidTicket, formatExtraRoundLabel } from "@/lib/ticket-shop-extra-display";
import { ensureExtraRoundMatchesCached } from "@/lib/football/extras-rodada";
import { extraBolaoCurrentRoundsByChampionship } from "@/lib/ticket-shop-extra-rounds";
import { syncExtraIfStale } from "@/lib/football/sync-orchestrator";
import { isAmistososFriendliesCompetition } from "@/lib/football/amistosos-friendlies";
import { ensureAmistososFriendliesMatchesSeeded } from "@/lib/football/amistosos-friendlies-persistence";
import {
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoCompetition,
} from "@/lib/boloes/skale-config";
import {
  getSkaleDailyBolaoCompetitionId,
  isSkaleDailyBolaoCompetition,
  paidTicketSkaleDailyEditionNumber,
  skaleDailyEditionLabel,
} from "@/lib/boloes/skale-daily-config";
import { ensureSkaleDailyBolaoMatchesMirrored } from "@/lib/boloes/skale-match-resolve";
import {
  getWeekendBolaoSourceCopaCompetitionId,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";
import { mirrorSkaleBolaoMatchesFromCopa } from "@/lib/football/skale-bolao-sync";
import { mirrorWeekendBolaoMatchesFromCopa } from "@/lib/football/weekend-bolao-sync";
import { readFootballApiCacheJson, standingsCacheKey } from "@/lib/football-api-cache-store";
import {
  dailyEditionLabel,
  formatDailyEditionDatesLabel,
  getDailyEdition,
  getDailyEditionDatesSet,
  isMatchInDailyEditionScope,
  paidTicketDailyEditionNumber,
} from "@/lib/boloes/daily-editions";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
type StatusJogo = "aberto" | "encerrado";
type TabelaGrupos = PalpitesInitialData["tabela"];

function formatData(dataStr?: string | null, isoStr?: string | null): string {
  const normalized = String(dataStr ?? "").trim();
  if (normalized && normalized !== "undefined" && normalized !== "null" && normalized.includes("/")) {
    const [day, month] = normalized.split("/");
    const d = Number.parseInt(day, 10);
    const m = Number.parseInt(month, 10);
    if (Number.isFinite(d) && Number.isFinite(m) && m >= 1 && m <= 12) {
      return `${MESES[m - 1]}. ${d}`;
    }
  }
  if (isoStr) {
    const dt = new Date(isoStr);
    if (!Number.isNaN(dt.getTime())) {
      const d = dt.getDate();
      const m = dt.getMonth();
      if (m >= 0 && m < 12) return `${MESES[m]}. ${d}`;
    }
  }
  return "--";
}

function safeHourLabel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "undefined" || raw === "null") return "--:--";
  const hhmm = raw.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  return "--:--";
}

function mapStatus(s: string): StatusJogo {
  const raw = String(s || "").toLowerCase();
  if (
    raw.includes("encerr") ||
    raw.includes("finaliz") ||
    raw.includes("fim de jogo") ||
    raw.includes("termino de jogo") ||
    raw.includes("cancel") ||
    raw.includes("adiad") ||
    raw.includes("suspens") ||
    raw.includes("interromp")
  ) {
    return "encerrado";
  }
  return "aberto";
}

function parseLiveTempoFromPartida(p: any): number | null {
  const periodo = String(p?.periodo ?? "").toLowerCase();
  if (periodo.includes("segundo")) return 2;
  if (periodo.includes("primeiro")) return 1;
  const v = p?.tempo ?? p?.tempo_partida ?? p?.numero_tempo;
  if (v === 1 || v === "1") return 1;
  if (v === 2 || v === "2") return 2;
  const s = String(v ?? "").toUpperCase();
  if (s.includes("PRIMEIRO") && s.includes("TEMPO")) return 1;
  if (s.includes("SEGUNDO") && s.includes("TEMPO") && !s.includes("PRIMEIRO")) return 2;
  return null;
}

function parseLiveMinutoFromPartida(p: any): number | null {
  const tryNum = (x: unknown): number | null => {
    if (typeof x === "number" && Number.isFinite(x)) return Math.max(0, Math.min(125, Math.trunc(x)));
    if (typeof x === "string") {
      const t = x.trim();
      if (!t) return null;
      if (/^\d{1,3}$/.test(t)) return Math.max(0, Math.min(125, parseInt(t, 10)));
      const head = t.split(":")[0];
      if (head && /^\d{1,3}$/.test(head)) return Math.max(0, Math.min(125, parseInt(head, 10)));
    }
    return null;
  };
  return (
    tryNum(p?.cronometro) ??
    tryNum(p?.minuto) ??
    tryNum(p?.minute) ??
    tryNum(p?.minuto_jogo) ??
    tryNum(p?.jogo?.minuto) ??
    tryNum(p?.placar_transmissao?.minuto) ??
    null
  );
}

/**
 * Resolve o número real da rodada de uma partida:
 *   1) `p.rodada` (vindo direto da coluna `matches_cache.rodada`)
 *   2) `p.round_key` (ex.: "17a-rodada" → 17)
 *   3) `rodadaKey` da chave do objeto (ex.: "17a-rodada" → 17)
 *   4) fallback: índice ordinal (legado)
 */
function resolveRodadaNumero(
  p: Record<string, any>,
  rodadaKey: string,
  rodadaIndexFallback: number,
): number {
  const direct = Number(p?.rodada);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const fromRoundKey = parseRodadaNumeroFromKey(String(p?.round_key ?? ""));
  if (fromRoundKey != null) return fromRoundKey;
  const fromObjKey = parseRodadaNumeroFromKey(String(rodadaKey ?? ""));
  if (fromObjKey != null) return fromObjKey;
  return rodadaIndexFallback;
}

function parseRodadaNumeroFromKey(key: string): number | null {
  const m = String(key || "").match(/(\d+)[ºoa]?[-]?rodada/i);
  if (m && m[1]) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // tenta extrair só o primeiro número da string (cobre "rodada-17", "17", etc.)
  const any = String(key || "").match(/(\d+)/);
  if (any && any[1]) {
    const n = Number.parseInt(any[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parsePartidas(faseData: Record<string, any>): PalpitesInitialData["jogos"] {
  const jogos: PalpitesInitialData["jogos"] = [];
  const grupoKeys = Object.keys(faseData).filter((k) => typeof faseData[k] === "object" && !Array.isArray(faseData[k]));
  const rodadaDiretaKeys = Object.keys(faseData).filter((k) => Array.isArray(faseData[k]));

  if (rodadaDiretaKeys.length > 0) {
    rodadaDiretaKeys.forEach((rodadaKey, rodadaIndex) => {
      const partidas = faseData[rodadaKey] ?? [];
      for (const p of partidas) {
        jogos.push({
          id: p.partida_id,
          timeCasa: (p.time_mandante?.nome_popular ?? "A DEFINIR").toUpperCase(),
          siglasCasa: p.time_mandante?.sigla ?? "---",
          escudoCasa: p.time_mandante?.escudo,
          timeVisitante: (p.time_visitante?.nome_popular ?? "A DEFINIR").toUpperCase(),
          siglasVisitante: p.time_visitante?.sigla ?? "---",
          escudoVisitante: p.time_visitante?.escudo,
          data: formatData(p.data_realizacao, p.data_realizacao_iso),
          dataBR: String(p.data_realizacao ?? ""),
          hora: safeHourLabel(p.hora_realizacao),
          statusBruto: String(p.status ?? ""),
          liveTempo: parseLiveTempoFromPartida(p),
          liveMinuto: parseLiveMinutoFromPartida(p),
          status: mapStatus(String(p.status ?? "")),
          grupo: "GERAL",
          rodada: resolveRodadaNumero(p, rodadaKey, rodadaIndex),
          kickoffAt: parseKickoffFromPartidaPayload(p),
          resultCasa: pickScoreFromPartidaPayload(p, "casa"),
          resultVisitante: pickScoreFromPartidaPayload(p, "visitante"),
        });
      }
    });
  }

  for (const grupoKey of grupoKeys) {
    const grupoLetra = grupoKey.replace("grupo-", "").toUpperCase();
    const grupoData = faseData[grupoKey];
    const rodadaKeys = Object.keys(grupoData ?? {}).filter((k) => Array.isArray(grupoData[k]));
    rodadaKeys.forEach((rodadaKey, rodadaIndex) => {
      const partidas = grupoData[rodadaKey] ?? [];
      for (const p of partidas) {
        jogos.push({
          id: p.partida_id,
          timeCasa: (p.time_mandante?.nome_popular ?? "A DEFINIR").toUpperCase(),
          siglasCasa: p.time_mandante?.sigla ?? "---",
          escudoCasa: p.time_mandante?.escudo,
          timeVisitante: (p.time_visitante?.nome_popular ?? "A DEFINIR").toUpperCase(),
          siglasVisitante: p.time_visitante?.sigla ?? "---",
          escudoVisitante: p.time_visitante?.escudo,
          data: formatData(p.data_realizacao, p.data_realizacao_iso),
          dataBR: String(p.data_realizacao ?? ""),
          hora: safeHourLabel(p.hora_realizacao),
          statusBruto: String(p.status ?? ""),
          liveTempo: parseLiveTempoFromPartida(p),
          liveMinuto: parseLiveMinutoFromPartida(p),
          status: mapStatus(String(p.status ?? "")),
          grupo: grupoLetra,
          rodada: resolveRodadaNumero(p, rodadaKey, rodadaIndex),
          kickoffAt: parseKickoffFromPartidaPayload(p),
          resultCasa: pickScoreFromPartidaPayload(p, "casa"),
          resultVisitante: pickScoreFromPartidaPayload(p, "visitante"),
        });
      }
    });
  }
  return jogos;
}

function parseAllPartidas(fases: Record<string, any> | undefined): {
  jogos: PalpitesInitialData["jogos"];
  grupos: string[];
} {
  if (!fases || typeof fases !== "object") return { jogos: [], grupos: [] };
  const phaseValues = Object.values(fases).filter((value) => value && typeof value === "object") as Record<string, any>[];
  const grupos = new Set<string>();
  // NOTA: o `rodadaOffset` legado (que somava 1 a cada fase) é INCORRETO
  // quando a `rodada` real já vem do payload — aqui usamos o valor que
  // `parsePartidas` retornou (já resolvido).
  const jogos = phaseValues.flatMap((faseData) => {
    return parsePartidas(faseData).map((jogo) => {
      if (jogo.grupo && jogo.grupo !== "GERAL") grupos.add(jogo.grupo);
      return jogo;
    });
  });
  return { jogos, grupos: Array.from(grupos).sort() };
}

function palpitesBolaoHeading(
  bolaoType: "principal" | "diario" | "extra",
  extraChampionshipId: number | null,
): string {
  if (bolaoType === "extra" && extraChampionshipId != null && Number.isFinite(extraChampionshipId) && extraChampionshipId > 0) {
    return resolveExtraBolaoDisplayName(extraChampionshipId);
  }
  if (bolaoType === "diario") return "Bolão diário";
  return "Copa do Mundo 2026";
}

async function buildInitialData(ticketId: string | null): Promise<PalpitesInitialData> {
  const c = await cookies();

  const token = c.get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;

  let bolaoType: "principal" | "diario" | "extra" = "principal";
  let extraChampionshipId: number | null = null;
  let extraRoundNumber: number | null = null;
  let extraRoundName: string | null = null;
  let ticketRoundFromDb: number | null = null;
  let dailyEditionNumber: number | null = null;
  let dailyEditionDates: string[] = [];
  let dailyEditionDatesLabel: string | null = null;
  let isSkaleDailyEditionPool = false;
  let isPromoBonus = false;
  const tid = ticketId?.trim() ?? "";
  if (tid) {
    const fromPrefix = inferBolaoTypeFromTicketPrefix(tid);
    if (fromPrefix) bolaoType = fromPrefix;
    if (userId) {
      const pool = getPool();
      const [inferred, ticketRows] = await Promise.all([
        inferBolaoTypeFromTicketId(tid),
        pool.query<{
          cid: number | null;
          rnum: number | null;
          is_promo_bonus: boolean;
          total_amount_cents: number | null;
          ticket_type: string;
        }>(
          `SELECT extra_championship_id AS cid, round_number AS rnum, ticket_type,
                  COALESCE(is_promo_bonus, false) AS is_promo_bonus,
                  COALESCE(total_amount_cents, 0) AS total_amount_cents
             FROM tickets
            WHERE id::text = $1 AND user_id = $2 AND status = 'paid'
            LIMIT 1`,
          [tid, userId],
        ),
      ]);
      if (inferred && inferred !== "artilheiros") bolaoType = inferred;
      const row = ticketRows.rows[0];
      isPromoBonus =
        Boolean(row?.is_promo_bonus) ||
        (row?.ticket_type === "extra" && Number(row?.total_amount_cents ?? 0) === 0);
      if (inferred === "extra") {
        const cid = row?.cid;
        extraChampionshipId = cid != null && Number.isFinite(Number(cid)) ? Number(cid) : null;
        const rnum = row?.rnum;
        extraRoundNumber = rnum != null && Number.isFinite(Number(rnum)) ? Number(rnum) : null;
        ticketRoundFromDb = extraRoundNumber;
        if (isSkaleDailyBolaoCompetition(extraChampionshipId)) {
          isSkaleDailyEditionPool = true;
          dailyEditionNumber = paidTicketSkaleDailyEditionNumber({
            ticketType: "extra",
            extraChampionshipId,
            round_number: row?.rnum,
          });
          const editionMeta =
            dailyEditionNumber != null ? getDailyEdition(dailyEditionNumber) : null;
          if (editionMeta) {
            dailyEditionDates = [...editionMeta.datesBR];
            dailyEditionDatesLabel = formatDailyEditionDatesLabel(editionMeta);
          }
        }
      }
      if (inferred === "diario" || row?.ticket_type === "daily") {
        bolaoType = "diario";
        dailyEditionNumber = paidTicketDailyEditionNumber({
          ticketType: "daily",
          round_number: row?.rnum,
        });
        const editionMeta =
          dailyEditionNumber != null ? getDailyEdition(dailyEditionNumber) : null;
        if (editionMeta) {
          dailyEditionDates = [...editionMeta.datesBR];
          dailyEditionDatesLabel = formatDailyEditionDatesLabel(editionMeta);
        }
      }
    }
  }
  if (bolaoType === "extra") {
    if (extraChampionshipId == null || !Number.isFinite(extraChampionshipId) || extraChampionshipId <= 0) {
      const sole = getSoleConfiguredExtraChampionshipId();
      if (sole != null) extraChampionshipId = sole;
    }
    if (
      extraChampionshipId != null &&
      Number.isFinite(extraChampionshipId) &&
      extraChampionshipId > 0
    ) {
      if (isSkaleBolaoCompetition(extraChampionshipId)) {
        extraRoundNumber = null;
        extraRoundName = "Copa inteira";
      } else if (isSkaleDailyBolaoCompetition(extraChampionshipId)) {
        extraRoundNumber = null;
        extraRoundName = null;
      } else if (isWeekendBolaoCompetition(extraChampionshipId)) {
        extraRoundNumber = null;
        extraRoundName = "Rodada do fim de semana";
      } else {
        let liveExtraRound: number | null = null;
        if (extraChampionshipId != null) {
          const liveRounds = await extraBolaoCurrentRoundsByChampionship([
            extraChampionshipId,
          ]).catch(() => ({} as Record<number, { roundNumber: number }>));
          liveExtraRound = liveRounds[extraChampionshipId]?.roundNumber ?? null;
        }
        const pinnedRound = effectiveExtraRoundForPaidTicket({
          championshipId: extraChampionshipId,
          roundNumberFromDb: ticketRoundFromDb,
          liveRoundNumber: liveExtraRound,
        });
        if (pinnedRound != null && pinnedRound > 0) {
          extraRoundNumber = pinnedRound;
          extraRoundName =
            formatExtraRoundLabel(pinnedRound) ??
            (isAmistososFriendliesCompetition(extraChampionshipId)
              ? "1ª Rodada"
              : `${pinnedRound}ª Rodada`);
        }
      }
    }
  }

  const mainComp = getFootballMainCompetitionId();
  const partidasCompId =
    bolaoType === "extra" && extraChampionshipId != null && extraChampionshipId > 0
      ? extraChampionshipId
      : mainComp;
  const isSkaleExtra =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    isSkaleBolaoCompetition(extraChampionshipId);
  const isSkaleDailyExtra =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    isSkaleDailyBolaoCompetition(extraChampionshipId);
  const isWeekendExtra =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    isWeekendBolaoCompetition(extraChampionshipId);

  const tabelaCompId = isSkaleExtra
    ? getSkaleBolaoSourceCopaCompetitionId()
    : isWeekendExtra
      ? getWeekendBolaoSourceCopaCompetitionId()
      : partidasCompId;
  const isAmistososExtra =
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    isAmistososFriendliesCompetition(extraChampionshipId);

  if (isAmistososExtra) {
    await ensureAmistososFriendliesMatchesSeeded().catch(() => {});
  }

  if (isSkaleExtra) {
    await mirrorSkaleBolaoMatchesFromCopa().catch(() => {});
  }

  if (isSkaleDailyExtra) {
    await ensureSkaleDailyBolaoMatchesMirrored().catch(() => {});
  }

  if (isWeekendExtra) {
    await mirrorWeekendBolaoMatchesFromCopa().catch(() => {});
  }

  if (
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    extraRoundNumber != null &&
    extraRoundNumber > 0 &&
    !isAmistososExtra &&
    !isSkaleExtra
  ) {
    await ensureExtraRoundMatchesCached(extraChampionshipId, extraRoundNumber).catch(
      () => {},
    );
  }

  const [tabelaPayload, fasesResult, predictionsBundle] = await Promise.all([
    readFootballApiCacheJson(standingsCacheKey(tabelaCompId)).catch(() => null),
    getPartidasFasesFromDb(partidasCompId).catch(() => null),
    userId && tid
      ? (async () => {
          const histComp =
            bolaoType === "extra" &&
            extraChampionshipId != null &&
            Number.isFinite(Number(extraChampionshipId)) &&
            Number(extraChampionshipId) > 0
              ? Number(extraChampionshipId)
              : mainComp;
          const ensureIds =
            bolaoType === "extra"
              ? ensureCompetitionIdsForBolaoExtra(histComp)
              : [];
          const [matches, preds] = await Promise.all([
            fetchMatchesMap({ ensureCompetitionIds: ensureIds }),
            listPredictions({ userId, ticketId: tid, bolaoType }),
          ]);
          const predictionsMap = preds.reduce(
            (acc, p) => {
              const matchId = Number(p.match_id);
              if (!Number.isFinite(matchId)) return acc;
              acc[matchId] = { scoreCasa: p.score_casa, scoreVisitante: p.score_visitante };
              return acc;
            },
            {} as Record<number, { scoreCasa: number; scoreVisitante: number }>,
          );

          let palpites = 0;
          let acertos = 0;
          let pontos = 0;
          let exatos = 0;
          const historicoRows = preds
            .map((p) => {
              palpites += 1;
              const matchId = Number(p.match_id);
              const normalizedMatchId = Number.isFinite(matchId) ? matchId : null;
              const m =
                normalizedMatchId != null
                  ? resolveBolaoMatchFromMap(matches, histComp, normalizedMatchId)
                  : undefined;
              const scored =
                m != null &&
                hasOfficialMatchResult({
                  status: m.status,
                  kickoffAt: m.kickoffAt,
                  resultCasa: m.resultCasa,
                  resultVisitante: m.resultVisitante,
                });
              const calc =
                scored && m
                  ? calcPredictionPoints(
                      p.score_casa,
                      p.score_visitante,
                      m.resultCasa!,
                      m.resultVisitante!,
                    )
                  : null;
              if (calc) {
                pontos += calc.points;
                acertos += calc.outcomeHit ? 1 : 0;
                exatos += calc.exact ? 1 : 0;
              }
              const matchInput = {
                matchStatus: m?.status ?? null,
                kickoffAt: m?.kickoffAt ?? null,
                jogoData: m?.dateBR,
                jogoHora: m?.hour,
                resultadoCasa: m?.resultCasa ?? null,
                resultadoVisitante: m?.resultVisitante ?? null,
              };
              const aoVivo = m ? isRankingHistoricoLive(matchInput) : false;
              return {
                matchId: normalizedMatchId ?? p.match_id,
                ticketId: p.ticket_id,
                bolaoType: p.bolao_type,
                mandante: m?.home ?? `Partida #${normalizedMatchId ?? p.match_id}`,
                visitante: m?.away ?? "-",
                jogoData: m?.dateBR ?? "-",
                jogoHora: m?.hour ?? "-",
                palpiteCasa: p.score_casa,
                palpiteVisitante: p.score_visitante,
                resultadoCasa: m?.resultCasa ?? null,
                resultadoVisitante: m?.resultVisitante ?? null,
                pontos: calc?.points ?? 0,
                exact: calc?.exact ?? false,
                aoVivo,
                liveLabel: aoVivo ? formatRankingHistoricoLiveLabel(matchInput) : null,
                matchStatus: m?.status ?? null,
                kickoffAt: m?.kickoffAt ?? null,
                submittedAt: p.submitted_at.toISOString(),
                updatedAt: p.updated_at.toISOString(),
              };
            })
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .slice(0, 30);

          return {
            predictionsMap,
            resumoStats: { palpites, acertos, pontos, exatos },
            historicoRows,
          };
        })()
      : Promise.resolve(null),
  ]);

  const partidasOk = fasesResult != null;
  const parsedPartidas = parseAllPartidas((fasesResult ?? {}) as Record<string, any>);
  let jogos = parsedPartidas.jogos;
  let grupos = parsedPartidas.grupos;
  if (
    bolaoType === "extra" &&
    !isSkaleExtra &&
    extraRoundNumber != null &&
    extraRoundNumber > 0
  ) {
    jogos = jogos.filter((j) => j.rodada === extraRoundNumber);
  }
  if (bolaoType === "diario" && dailyEditionNumber != null) {
    jogos = jogos.filter((j) =>
      isMatchInDailyEditionScope(
        { dateBR: j.dataBR, hora: j.hora, kickoffAt: j.kickoffAt },
        dailyEditionNumber,
      ),
    );
  }
  if (isSkaleDailyExtra && dailyEditionNumber != null) {
    const editionDates = getDailyEditionDatesSet(dailyEditionNumber);
    jogos = jogos.filter(
      (j) => j.dataBR != null && editionDates.has(j.dataBR),
    );
  }

  if (
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    extraRoundNumber != null &&
    extraRoundNumber > 0 &&
    jogos.length === 0 &&
    !isAmistososExtra &&
    !isSkaleExtra
  ) {
    await syncExtraIfStale(extraChampionshipId, {
      extraRodadas: [extraRoundNumber],
      onlyIfEmpty: false,
    }).catch(() => {});
    const retryFases = await getPartidasFasesFromDb(partidasCompId).catch(() => null);
    if (retryFases != null) {
      const retryParsed = parseAllPartidas(retryFases as Record<string, any>);
      jogos = retryParsed.jogos.filter((j) => j.rodada === extraRoundNumber);
      grupos = retryParsed.grupos;
    }
  }

  const tabelaGrupos =
    pickTabelaGruposForPalpites(tabelaPayload) ??
    (bolaoType === "extra" ? ({ "grupo-geral": [] } as TabelaGrupos) : null);
  const tabelaOk =
    bolaoType !== "extra" || isSkaleExtra || isWeekendExtra
      ? tabelaPayload != null
      : true;

  return {
    ticketId,
    bolaoType,
    isPromoBonus,
    extraChampionshipId,
    extraRoundNumber,
    extraRoundName,
    isSkaleFullCopaPool: isSkaleExtra || isWeekendExtra,
    bolaoHeading:
      isSkaleDailyExtra && dailyEditionNumber != null
        ? `${skaleDailyEditionLabel(dailyEditionNumber)}${dailyEditionDatesLabel ? ` · ${dailyEditionDatesLabel}` : ""}`
        : bolaoType === "diario" && dailyEditionNumber != null
          ? `${dailyEditionLabel(dailyEditionNumber)}${dailyEditionDatesLabel ? ` · ${dailyEditionDatesLabel}` : ""}`
          : palpitesBolaoHeading(bolaoType, extraChampionshipId),
    isSkaleDailyEditionPool: isSkaleDailyExtra,
    dailyEditionNumber,
    dailyEditionDates,
    dailyEditionDatesLabel,
    tabela: (tabelaGrupos ?? { "grupo-geral": [] }) as TabelaGrupos,
    jogos,
    grupos,
    grupo: grupos[0] ?? "GERAL",
    erro: !partidasOk || !tabelaOk,
    predictionsMap: predictionsBundle?.predictionsMap ?? {},
    resumoStats: predictionsBundle?.resumoStats ?? { palpites: 0, acertos: 0, pontos: 0, exatos: 0 },
    historicoRows: predictionsBundle?.historicoRows ?? [],
  };
}

function emptyPalpitesInitialData(ticketId: string | null): PalpitesInitialData {
  return {
    ticketId,
    bolaoType: "principal",
    isPromoBonus: false,
    extraChampionshipId: null,
    extraRoundNumber: null,
    extraRoundName: null,
    isSkaleFullCopaPool: false,
    isSkaleDailyEditionPool: false,
    bolaoHeading: "Palpites",
    dailyEditionNumber: null,
    dailyEditionDates: [],
    dailyEditionDatesLabel: null,
    tabela: { "grupo-geral": [] },
    jogos: [],
    grupos: [],
    grupo: "GERAL",
    erro: true,
    predictionsMap: {},
    resumoStats: { palpites: 0, acertos: 0, pontos: 0, exatos: 0 },
    historicoRows: [],
  };
}

export default async function PalpitesPage(props: { searchParams?: Promise<{ ticket?: string }> | { ticket?: string } }) {
  const searchParams =
    props.searchParams && typeof (props.searchParams as Promise<{ ticket?: string }>).then === "function"
      ? await (props.searchParams as Promise<{ ticket?: string }>)
      : (props.searchParams as { ticket?: string } | undefined);
  const ticketId = searchParams?.ticket?.trim() || null;
  if (ticketId) {
    const inferred = await inferBolaoTypeFromTicketId(ticketId);
    if (inferred === "artilheiros") {
      redirect(`/palpites/artilheiros?ticket=${encodeURIComponent(ticketId)}`);
    }
  }

  const initialData = await runSafeServerPage(
    "palpites-build",
    () => buildInitialData(ticketId),
    emptyPalpitesInitialData(ticketId),
  );
  return <PalpitesClient initialData={initialData} />;
}
