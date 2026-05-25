import { cookies, headers } from "next/headers";
import PalpitesClient, { type PalpitesInitialData } from "./PalpitesClient";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind-shared";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
import { fetchMatchesMap, getMatchFromMap } from "@/lib/football-api";
import { getPartidasFasesFromDb } from "@/lib/partidas-cache-payload";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import { getPool } from "@/lib/db";
import { parseKickoffFromPartidaPayload, pickScoreFromPartidaPayload } from "@/lib/partida-placar";
import { pickTabelaGruposForPalpites } from "@/lib/tabela-palpites-normalize";
import { resolveEffectiveExtraRoundForTicket } from "@/lib/football/extras-rodada";
import { syncExtra } from "@/lib/football/sync-orchestrator";

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
          timeCasa: p.time_mandante.nome_popular.toUpperCase(),
          siglasCasa: p.time_mandante.sigla,
          escudoCasa: p.time_mandante.escudo,
          timeVisitante: p.time_visitante.nome_popular.toUpperCase(),
          siglasVisitante: p.time_visitante.sigla,
          escudoVisitante: p.time_visitante.escudo,
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
          timeCasa: p.time_mandante.nome_popular.toUpperCase(),
          siglasCasa: p.time_mandante.sigla,
          escudoCasa: p.time_mandante.escudo,
          timeVisitante: p.time_visitante.nome_popular.toUpperCase(),
          siglasVisitante: p.time_visitante.sigla,
          escudoVisitante: p.time_visitante.escudo,
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

function resolveBaseUrl(h: Headers): string {
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    (() => {
      try {
        return new URL(process.env.APP_URL || "https://bolaodomilhao.com.br").host;
      } catch {
        return "bolaodomilhao.com.br";
      }
    })();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function fetchJson(baseUrl: string, path: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { data, ok: res.ok };
}

function palpitesBolaoHeading(
  bolaoType: "principal" | "diario" | "extra",
  extraChampionshipId: number | null,
): string {
  if (bolaoType === "extra" && extraChampionshipId != null && Number.isFinite(extraChampionshipId) && extraChampionshipId > 0) {
    return resolveExtraBolaoDisplayName(extraChampionshipId);
  }
  if (bolaoType === "diario") return "Bolão do dia";
  return "Copa do Mundo 2026";
}

async function buildInitialData(ticketId: string | null): Promise<PalpitesInitialData> {
  const h = await headers();
  const c = await cookies();
  const baseUrl = resolveBaseUrl(h);
  const cookieHeader = c.toString();

  const token = c.get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;

  let bolaoType: "principal" | "diario" | "extra" = "principal";
  let extraChampionshipId: number | null = null;
  let extraRoundNumber: number | null = null;
  let extraRoundName: string | null = null;
  let ticketRoundFromDb: number | null = null;
  const tid = ticketId?.trim() ?? "";
  if (tid) {
    const fromPrefix = inferBolaoTypeFromTicketPrefix(tid);
    if (fromPrefix) bolaoType = fromPrefix;
    if (userId) {
      const inferred = await inferBolaoTypeFromTicketId(tid);
      if (inferred) bolaoType = inferred;
      if (inferred === "extra") {
        const pool = getPool();
        const { rows: exRows } = await pool.query<{
          cid: number | null;
          rnum: number | null;
        }>(
          `SELECT extra_championship_id AS cid, round_number AS rnum
             FROM tickets
            WHERE id::text = $1 AND user_id = $2 AND status = 'paid'
            LIMIT 1`,
          [tid, userId],
        );
        const cid = exRows[0]?.cid;
        extraChampionshipId = cid != null && Number.isFinite(Number(cid)) ? Number(cid) : null;
        const rnum = exRows[0]?.rnum;
        extraRoundNumber = rnum != null && Number.isFinite(Number(rnum)) ? Number(rnum) : null;
        ticketRoundFromDb = extraRoundNumber;
      }
    }
  }
  if (bolaoType === "extra") {
    if (extraChampionshipId == null || !Number.isFinite(extraChampionshipId) || extraChampionshipId <= 0) {
      const sole = getSoleConfiguredExtraChampionshipId();
      if (sole != null) extraChampionshipId = sole;
    }
    // Brinde com rodada fixa (ex. 18ª) não troca pela rodada “ao vivo” da API.
    if (
      extraChampionshipId != null &&
      Number.isFinite(extraChampionshipId) &&
      extraChampionshipId > 0 &&
      extraRoundNumber == null
    ) {
      try {
        const resolved = await resolveEffectiveExtraRoundForTicket(
          extraChampionshipId,
          ticketRoundFromDb,
        );
        if (resolved?.rodada != null && Number.isFinite(resolved.rodada) && resolved.rodada > 0) {
          extraRoundNumber = resolved.rodada;
          extraRoundName =
            resolved.rodadaNome?.trim() || `${resolved.rodada}ª Rodada`;
          if (
            userId &&
            tid &&
            ticketRoundFromDb != null &&
            ticketRoundFromDb + 1 === resolved.rodada &&
            ticketRoundFromDb < resolved.rodada
          ) {
            const pool = getPool();
            await pool
              .query(
                `UPDATE tickets SET round_number = $1
                  WHERE id::text = $2 AND user_id = $3 AND ticket_type = 'extra'`,
                [resolved.rodada, tid, userId],
              )
              .catch(() => {});
          }
        }
      } catch {
        // sem rodada atual no cache → cliente decide (mostra todas as rodadas)
      }
    } else if (
      extraRoundNumber != null &&
      extraRoundNumber > 0 &&
      !extraRoundName
    ) {
      extraRoundName = `${extraRoundNumber}ª Rodada`;
    }
  }

  const mainComp = getFootballMainCompetitionId();
  const tabelaCompId =
    bolaoType === "extra" && extraChampionshipId != null && extraChampionshipId > 0
      ? extraChampionshipId
      : mainComp;
  const tabelaRes = await fetchJson(
    baseUrl,
    `/api/tabela?competitionId=${encodeURIComponent(String(tabelaCompId))}`,
    cookieHeader,
  );

  let partidasOk = true;
  let fases: Record<string, any> = {};
  try {
    const compId =
      bolaoType === "extra" && extraChampionshipId != null && extraChampionshipId > 0
        ? extraChampionshipId
        : getFootballMainCompetitionId();
    fases = (await getPartidasFasesFromDb(compId)) as Record<string, any>;
  } catch {
    partidasOk = false;
  }
  let parsedPartidas = parseAllPartidas(fases);
  let jogos = parsedPartidas.jogos;
  if (
    bolaoType === "extra" &&
    extraChampionshipId != null &&
    extraRoundNumber != null &&
    jogos.filter((j) => j.rodada === extraRoundNumber).length === 0
  ) {
    await syncExtra(extraChampionshipId).catch(() => {});
    try {
      fases = (await getPartidasFasesFromDb(extraChampionshipId)) as Record<string, any>;
      parsedPartidas = parseAllPartidas(fases);
      jogos = parsedPartidas.jogos;
    } catch {
      /* mantém lista anterior */
    }
  }
  const jogosFiltrados = jogos;
  const grupos = parsedPartidas.grupos;

  let predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }> = {};
  let resumoStats: PalpitesInitialData["resumoStats"] = { palpites: 0, acertos: 0, pontos: 0, exatos: 0 };
  let historicoRows: PalpitesInitialData["historicoRows"] = [];

  if (userId) {
    const matches = await fetchMatchesMap();

    if (tid) {
      const preds = await listPredictions({ userId, ticketId: tid, bolaoType });
      const histComp =
        bolaoType === "extra" &&
        extraChampionshipId != null &&
        Number.isFinite(Number(extraChampionshipId)) &&
        Number(extraChampionshipId) > 0
          ? Number(extraChampionshipId)
          : mainComp;
      predictionsMap = preds.reduce((acc, p) => {
        const matchId = Number(p.match_id);
        if (!Number.isFinite(matchId)) return acc;
        acc[matchId] = { scoreCasa: p.score_casa, scoreVisitante: p.score_visitante };
        return acc;
      }, {} as Record<number, { scoreCasa: number; scoreVisitante: number }>);

      let palpites = 0;
      let acertos = 0;
      let pontos = 0;
      let exatos = 0;
      historicoRows = preds
        .map((p) => {
          palpites += 1;
          const matchId = Number(p.match_id);
          const normalizedMatchId = Number.isFinite(matchId) ? matchId : null;
          const m =
            normalizedMatchId != null ? getMatchFromMap(matches, histComp, normalizedMatchId) : undefined;
          const scored = m?.resultCasa != null && m?.resultVisitante != null;
          const calc =
            scored && m
              ? calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa!, m.resultVisitante!)
              : null;
          if (calc) {
            pontos += calc.points;
            acertos += calc.outcomeHit ? 1 : 0;
            exatos += calc.exact ? 1 : 0;
          }
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
            submittedAt: p.submitted_at.toISOString(),
            updatedAt: p.updated_at.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, 30);
      resumoStats = { palpites, acertos, pontos, exatos };
    }

  }

  return {
    ticketId,
    bolaoType,
    extraChampionshipId,
    extraRoundNumber,
    extraRoundName,
    bolaoHeading: palpitesBolaoHeading(bolaoType, extraChampionshipId),
    tabela: pickTabelaGruposForPalpites(tabelaRes.data) as TabelaGrupos,
    jogos: jogosFiltrados,
    grupos,
    grupo: grupos[0] ?? "GERAL",
    erro: !partidasOk || !tabelaRes.ok,
    predictionsMap,
    resumoStats,
    historicoRows,
  };
}

export default async function PalpitesPage(props: { searchParams?: Promise<{ ticket?: string }> | { ticket?: string } }) {
  const searchParams =
    props.searchParams && typeof (props.searchParams as Promise<{ ticket?: string }>).then === "function"
      ? await (props.searchParams as Promise<{ ticket?: string }>)
      : (props.searchParams as { ticket?: string } | undefined);
  const ticketId = searchParams?.ticket?.trim() || null;
  const initialData = await buildInitialData(ticketId);
  return <PalpitesClient initialData={initialData} />;
}
