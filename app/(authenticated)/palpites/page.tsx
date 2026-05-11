import { cookies, headers } from "next/headers";
import PalpitesClient, { type PalpitesInitialData } from "./PalpitesClient";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { calcPredictionPoints, listPredictions } from "@/lib/predictions";
import { fetchMatchesMap } from "@/lib/football-api";

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
    raw.includes("cancel") ||
    raw.includes("adiad") ||
    raw.includes("suspens") ||
    raw.includes("interromp")
  ) {
    return "encerrado";
  }
  return "aberto";
}

function parseKickoffISO(
  dataRealizacaoISO: string | null | undefined,
  dataRealizacao: string | null | undefined,
  hora: string | null | undefined
): string | null {
  if (dataRealizacaoISO) {
    const parsed = new Date(dataRealizacaoISO);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = dataRealizacao.split("/");
  if (!d || !m || !y) return null;
  const hhmm = hora.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

function pickScore(p: any, side: "casa" | "visitante"): number | null {
  const keys =
    side === "casa"
      ? ["placar_mandante", "placar", "gols_mandante", "resultado_mandante"]
      : ["placar_visitante", "gols_visitante", "resultado_visitante"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
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
          status: mapStatus(p.status),
          grupo: "GERAL",
          rodada: rodadaIndex,
          kickoffAt: parseKickoffISO(p.data_realizacao_iso, p.data_realizacao, p.hora_realizacao),
          resultCasa: pickScore(p, "casa"),
          resultVisitante: pickScore(p, "visitante"),
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
          status: mapStatus(p.status),
          grupo: grupoLetra,
          rodada: rodadaIndex,
          kickoffAt: parseKickoffISO(p.data_realizacao_iso, p.data_realizacao, p.hora_realizacao),
          resultCasa: pickScore(p, "casa"),
          resultVisitante: pickScore(p, "visitante"),
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
  let rodadaOffset = 0;
  const grupos = new Set<string>();
  const jogos = phaseValues.flatMap((faseData) => {
    const parsed = parsePartidas(faseData).map((jogo) => {
      if (jogo.grupo && jogo.grupo !== "GERAL") grupos.add(jogo.grupo);
      return { ...jogo, rodada: jogo.rodada + rodadaOffset };
    });
    const localRodadas = parsed.map((jogo) => jogo.rodada - rodadaOffset);
    rodadaOffset += Math.max(1, new Set(localRodadas).size);
    return parsed;
  });
  return { jogos, grupos: Array.from(grupos).sort() };
}

function pickTabelaGrupos(data: any): TabelaGrupos {
  if (!data || typeof data !== "object") return null;
  if (data["fase-de-grupos"] && typeof data["fase-de-grupos"] === "object") {
    return data["fase-de-grupos"] as TabelaGrupos;
  }
  if (Object.keys(data).some((key) => key.startsWith("grupo-"))) {
    return data as TabelaGrupos;
  }
  const firstGrouped = Object.values(data).find(
    (value) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).some((key) => key.startsWith("grupo-"))
  );
  return (firstGrouped as TabelaGrupos) ?? null;
}

function resolveBaseUrl(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
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

async function buildInitialData(ticketId: string | null): Promise<PalpitesInitialData> {
  const h = await headers();
  const c = await cookies();
  const baseUrl = resolveBaseUrl(h);
  const cookieHeader = c.toString();

  const [tabelaRes, partidasRes] = await Promise.all([
    fetchJson(baseUrl, "/api/tabela", cookieHeader),
    fetchJson(baseUrl, "/api/partidas", cookieHeader),
  ]);

  const fases = (partidasRes.data as any)?.partidas as Record<string, any> | undefined;
  const parsedPartidas = parseAllPartidas(fases);
  const jogos = parsedPartidas.jogos;
  const jogosFiltrados = jogos;
  const grupos = parsedPartidas.grupos;

  const token = c.get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;

  let bolaoType: "principal" | "diario" = "principal";
  let predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }> = {};
  let rankingRows: PalpitesInitialData["rankingRows"] = [];
  let resumoStats: PalpitesInitialData["resumoStats"] = { palpites: 0, acertos: 0, pontos: 0, exatos: 0 };
  let historicoRows: PalpitesInitialData["historicoRows"] = [];

  if (userId) {
    const matches = await fetchMatchesMap();

    if (ticketId) {
      const inferred = await inferBolaoTypeFromTicketId(ticketId);
      if (inferred) bolaoType = inferred;

      const preds = await listPredictions({ userId, ticketId, bolaoType: inferred ?? undefined });
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
          const m = normalizedMatchId != null ? matches.get(normalizedMatchId) : undefined;
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

    let rankingPreds = await listPredictions({ userId, bolaoType: ticketId ? bolaoType : undefined });
    if (ticketId && bolaoType === "diario") {
      const selectedDates = new Set(
        rankingPreds
          .filter((p) => p.ticket_id === ticketId)
          .map((p) => matches.get(Number(p.match_id))?.dateBR)
          .filter((d): d is string => Boolean(d))
      );
      if (selectedDates.size > 0) {
        rankingPreds = rankingPreds.filter((p) => {
          const d = matches.get(Number(p.match_id))?.dateBR;
          return d ? selectedDates.has(d) : false;
        });
      } else {
        rankingPreds = rankingPreds.filter((p) => p.ticket_id === ticketId);
      }
    }
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
    for (const p of rankingPreds) {
      const matchId = Number(p.match_id);
      if (!Number.isFinite(matchId)) continue;
      const m = matches.get(matchId);
      if (!m || m.resultCasa == null || m.resultVisitante == null) continue;
      const cur =
        byTicket.get(p.ticket_id) ??
        {
          ticketId: p.ticket_id,
          totalPoints: 0,
          exactCount: 0,
          outcomeCount: 0,
          goalsCount: 0,
          bestStreak: 0,
          firstSubmitAt: new Date(p.submitted_at).getTime(),
          hitSequence: [],
        };
      const calc = calcPredictionPoints(p.score_casa, p.score_visitante, m.resultCasa, m.resultVisitante);
      cur.totalPoints += calc.points;
      cur.exactCount += calc.exact ? 1 : 0;
      cur.outcomeCount += calc.outcomeHit ? 1 : 0;
      cur.goalsCount += calc.goalsHitCount;
      cur.hitSequence.push({
        order: m.kickoffAt ? new Date(m.kickoffAt).getTime() : matchId,
        hit: calc.points > 0,
      });
      const sub = new Date(p.submitted_at).getTime();
      if (sub < cur.firstSubmitAt) cur.firstSubmitAt = sub;
      byTicket.set(p.ticket_id, cur);
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
    rankingRows = rows.map((r, idx) => ({
      pos: idx + 1,
      nome: r.ticketId,
      iniciais: r.ticketId.slice(0, 2).toUpperCase(),
      acertos: r.outcomeCount,
      pts: r.totalPoints,
      exact: r.exactCount,
      gols: r.goalsCount,
      isMe: ticketId ? ticketId === r.ticketId : false,
    }));
  }

  return {
    ticketId,
    bolaoType,
    tabela: pickTabelaGrupos(tabelaRes.data as any),
    jogos: jogosFiltrados,
    grupos,
    grupo: grupos[0] ?? "GERAL",
    erro: !partidasRes.ok,
    predictionsMap,
    rankingRows,
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
