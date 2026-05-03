"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, BarChart2, Trophy, AlignJustify, Target, CircleCheck, Star, Bell, Coins, AlertTriangle, Disc, Pencil, Loader2 } from "lucide-react";
import { TrophyGold, TrophySilver, TrophyBronze } from "@/app/shared/RankingTrophies";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";
import { StepsBreadcrumb } from "../boloes/_components/StepsBreadcrumb";
import {
  calcPredictionPoints,
} from "./lib/predictionsStorage";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind";

// ── Tipos ────────────────────────────────────────────────────
type TabView = "jogos" | "tabela" | "ranking" | "resumo";
type ResultTabView = "jogos" | "ranking" | "resumo";
type StatusJogo = "aberto" | "encerrado";

interface ClassificacaoTime {
  posicao: number;
  pontos: number;
  time: { time_id: number; nome_popular: string; sigla: string; escudo: string };
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
}
type TabelaGrupos = Record<string, ClassificacaoTime[]>;

interface Jogo {
  id: number;
  timeCasa: string;
  siglasCasa: string;
  escudoCasa: string;
  timeVisitante: string;
  siglasVisitante: string;
  escudoVisitante: string;
  data: string;
  hora: string;
  status: StatusJogo;
  grupo: string;
  rodada: number;
  dataBR: string;
  kickoffAt: string | null;
  resultCasa: number | null;
  resultVisitante: number | null;
}

// ── Helpers ──────────────────────────────────────────────────
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
function rodadaLabel(idx: number): string {
  return `${idx + 1}ª Rodada`;
}

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

function todayBR(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function brDateToUtcMs(dateBR: string): number | null {
  const [d, m, y] = dateBR.split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  return Date.UTC(year, month - 1, day);
}

function isLockedByKickoff(kickoffAt: string | null | undefined, nowMs: number): boolean {
  if (!kickoffAt) return false;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (!Number.isFinite(kickoffMs)) return false;
  return nowMs >= kickoffMs - 60 * 60 * 1000;
}

function resolveDiarioPlayableDateFromJogos(jogos: Jogo[]): string {
  const today = todayBR();
  const todayMs = brDateToUtcMs(today);
  const dates = Array.from(new Set(jogos.map((j) => j.dataBR).filter(Boolean)));
  if (dates.includes(today)) return today;
  const future = dates
    .map((d) => ({ d, ms: brDateToUtcMs(d) }))
    .filter((x): x is { d: string; ms: number } => x.ms != null && todayMs != null && x.ms >= todayMs)
    .sort((a, b) => a.ms - b.ms);
  return future[0]?.d ?? today;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePartidas(faseData: Record<string, any>): Jogo[] {
  const jogos: Jogo[] = [];
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ── Escudo do time ────────────────────────────────────────────
function Escudo({ url, alt }: { url: string; alt: string }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
      style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="w-10 h-10 object-contain" />
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden mb-3 bg-[#0A0E19] border border-white/[0.07] animate-pulse">
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-white/10 rounded" />
          <div className="h-3 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-6 w-20 bg-white/10 rounded-full" />
      </div>
      <div className="mx-5 h-px bg-white/10" />
      <div className="flex items-center justify-between px-5 py-5 gap-2">
        <div className="w-14 h-14 rounded-2xl bg-white/10" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="w-10 h-8 bg-white/10 rounded" />
          <div className="w-9 h-9 rounded-xl bg-white/10" />
        </div>
        <div className="w-6 h-6 bg-white/10 rounded" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="w-10 h-8 bg-white/10 rounded" />
          <div className="w-9 h-9 rounded-xl bg-white/10" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10" />
      </div>
      <div className="mx-5 h-px bg-white/10 mb-5" />
      <div className="px-4 pb-4">
        <div className="w-full h-12 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

// ── Score animado ─────────────────────────────────────────────
function ScoreDisplay({ value, dir }: { value: number; dir: "up" | "down" }) {
  return (
    <div className="h-11 w-10 overflow-hidden relative flex items-center justify-center">
      <span
        key={value}
        className={`text-white font-black text-4xl leading-none absolute ${dir === "up" ? "animate-score-up" : "animate-score-down"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Card do jogo ──────────────────────────────────────────────
function JogoCard({
  jogo,
  readOnly = false,
  ticketId,
  initialPrediction,
  predictionsLoading = false,
  onSavePrediction,
}: {
  jogo: Jogo;
  readOnly?: boolean;
  ticketId: string | null;
  initialPrediction?: { scoreCasa: number; scoreVisitante: number } | null;
  predictionsLoading?: boolean;
  onSavePrediction?: (payload: { matchId: number; scoreCasa: number; scoreVisitante: number }) => Promise<void>;
}) {
  const [scoreCasa, setScoreCasa] = useState(0);
  const [scoreVisitante, setScoreVisitante] = useState(0);
  const [dirCasa, setDirCasa] = useState<"up" | "down">("up");
  const [dirVisitante, setDirVisitante] = useState<"up" | "down">("up");
  const [palpiteSalvo, setPalpiteSalvo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const p = initialPrediction;
    if (!p) return;
    setScoreCasa(p.scoreCasa);
    setScoreVisitante(p.scoreVisitante);
    setPalpiteSalvo(true);
  }, [initialPrediction]);

  const lockAtMs = jogo.kickoffAt ? new Date(jogo.kickoffAt).getTime() - 60 * 60 * 1000 : null;
  const isLockedByTime = lockAtMs != null ? Date.now() >= lockAtMs : false;
  const canEdit = !readOnly && jogo.status === "aberto" && !isLockedByTime;

  function increment(side: "casa" | "visitante") {
    setSaveError(null);
    if (side === "casa") {
      setDirCasa("up");
      setScoreCasa((v) => Math.min(v + 1, 99));
    } else {
      setDirVisitante("up");
      setScoreVisitante((v) => Math.min(v + 1, 99));
    }
  }
  function decrement(side: "casa" | "visitante") {
    setSaveError(null);
    if (side === "casa") {
      setDirCasa("down");
      setScoreCasa((v) => Math.max(v - 1, 0));
    } else {
      setDirVisitante("down");
      setScoreVisitante((v) => Math.max(v - 1, 0));
    }
  }

  const disabled = readOnly || !canEdit || palpiteSalvo || isSubmitting || predictionsLoading;
  const hasInitialPrediction = Boolean(initialPrediction);

  const review =
    readOnly && jogo.resultCasa != null && jogo.resultVisitante != null
      ? calcPredictionPoints(scoreCasa, scoreVisitante, jogo.resultCasa, jogo.resultVisitante)
      : null;

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3 bg-[#0A0E19]"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Topo */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-white font-extrabold text-[15px] tracking-wide">
            {jogo.timeCasa}
          </p>
          <p className="text-white/40 text-[12px] mt-0.5">VS {jogo.timeVisitante}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[#FFE8BA] text-[12px] font-medium">
            {formatData(jogo.dataBR, jogo.kickoffAt)}, {safeHourLabel(jogo.hora)}
          </span>
          {readOnly && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)" }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#93C5FD" }}>Resultado</span>
            </div>
          )}
          {!readOnly && jogo.status === "aberto" && !palpiteSalvo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "#22C55E1A", border: "2px solid #22C55E33" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-bold text-[#22C55E] uppercase tracking-wide">
                {isLockedByTime ? "Fechado (1h)" : "Aberto"}
              </span>
            </div>
          )}
          {!readOnly && palpiteSalvo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(254,197,84,0.12)", border: "1px solid rgba(254,197,84,0.25)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FEC554" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#FEC554" }}>Salvo</span>
            </div>
          )}
          {jogo.status === "encerrado" && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="text-[11px] font-bold text-white/30 uppercase tracking-wide">Encerrado</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-[#ffffff31]" />

      {/* Área de palpite */}
      <div className="flex items-center justify-between px-5 py-5 gap-2">
        <Escudo url={jogo.escudoCasa} alt={jogo.timeCasa} />

        {readOnly ? (
          <div className="flex items-center gap-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[26px] font-black"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
            >
              {scoreCasa}
            </div>
            <span className="text-white/25 font-light text-2xl">×</span>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[26px] font-black"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
            >
              {scoreVisitante}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => increment("casa")}
                disabled={disabled}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
                style={{ opacity: disabled ? 0.3 : 1 }}
              >
                <ChevronUp className="w-4 h-4 text-[#FFE8BA]" />
              </button>
              <ScoreDisplay value={scoreCasa} dir={dirCasa} />
              <button
                onClick={() => decrement("casa")}
                disabled={disabled}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
                style={{ opacity: disabled ? 0.3 : 1 }}
              >
                <ChevronDown className="w-4 h-4 text-[#FFE8BA]" />
              </button>
            </div>

            <span className="text-white/20 font-light text-2xl mb-1">×</span>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => increment("visitante")}
                disabled={disabled}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
                style={{ opacity: disabled ? 0.3 : 1 }}
              >
                <ChevronUp className="w-4 h-4 text-[#FFE8BA]" />
              </button>
              <ScoreDisplay value={scoreVisitante} dir={dirVisitante} />
              <button
                onClick={() => decrement("visitante")}
                disabled={disabled}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
                style={{ opacity: disabled ? 0.3 : 1 }}
              >
                <ChevronDown className="w-4 h-4 text-[#FFE8BA]" />
              </button>
            </div>
          </>
        )}

        <Escudo url={jogo.escudoVisitante} alt={jogo.timeVisitante} />
      </div>

      <div className="mx-5 h-px bg-[#ffffff31] mb-5" />

      {/* Botão */}
      <div className="px-4 pb-4">
        {readOnly ? (
          <div
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: review && review.points > 0 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              border: review && review.points > 0 ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <span
              className="font-black text-[14px]"
              style={{ color: review && review.points > 0 ? "#4ADE80" : "rgba(255,255,255,0.72)" }}
            >
              {review && review.points > 0
                ? `Voce ganhou ${review.points} pts nesta partida`
                : "Sem pontuacao nesta partida"}
            </span>
          </div>
        ) : predictionsLoading ? (
          <div
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <Loader2 className="w-4 h-4 animate-spin text-white/70" />
            <span className="font-bold text-[14px] text-white/70">Carregando palpite...</span>
          </div>
        ) : palpiteSalvo ? (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}
            >
              <CircleCheck className="w-4 h-4" style={{ color: "#34D399" }} strokeWidth={2.5} />
              <span className="font-black text-[15px]" style={{ color: "#34D399" }}>Palpite salvo</span>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setSaveError(null);
                  setPalpiteSalvo(false);
                }}
                disabled={isSubmitting}
                className="h-[50px] px-4 rounded-xl flex items-center gap-1.5 transition-all duration-200 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Pencil className="w-3.5 h-3.5 text-white/50" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-white/50">Editar</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={async () => {
              if (!ticketId || !onSavePrediction) return;
              setSaveError(null);
              setIsSubmitting(true);
              try {
                await onSavePrediction({
                  matchId: jogo.id,
                  scoreCasa,
                  scoreVisitante,
                });
                setPalpiteSalvo(true);
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : "Erro ao salvar palpite");
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={!canEdit || !ticketId || isSubmitting}
            className="w-full py-3.5 rounded-xl font-black text-[16px] transition-all duration-200"
            style={{
              background: !canEdit || !ticketId || isSubmitting ? "#0A0E19" : "#fff",
              color: !canEdit || !ticketId || isSubmitting ? "rgba(255,255,255,0.2)" : "#0A0E19",
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting
                ? "Salvando palpite..."
                : isLockedByTime
                  ? "Apostas encerradas (1h antes)"
                  : hasInitialPrediction
                    ? "Atualizar palpite"
                    : "Fazer Palpite"}
            </span>
          </button>
        )}
        {saveError ? <p className="mt-2 text-[12px] text-red-300">{saveError}</p> : null}
      </div>
    </div>
  );
}

// ── Tabela de classificação ───────────────────────────────────
function TabelaView({
  grupo,
  tabela,
  onGrupo,
  loading,
}: {
  grupo: string;
  tabela: TabelaGrupos | null;
  onGrupo: (g: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mb-3" />
        <p className="text-white/30 text-sm">Carregando tabela...</p>
      </div>
    );
  }
  if (!tabela) {
    return (
      <div className="flex flex-col items-center py-16">
        <Disc className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
        <p className="text-white/30 text-sm">Tabela indisponível no momento</p>
      </div>
    );
  }

  const grupoKey = `grupo-${grupo.toLowerCase()}`;
  const times = tabela[grupoKey] ?? [];
  const todosGrupos = Object.entries(tabela)
    .filter(([k]) => k.startsWith("grupo-"))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      {/* Classificação do grupo selecionado */}
      <div
        className="rounded-2xl overflow-hidden mb-5"
        style={{ background: "#0A0E19", border: "1px solid #FFFFFF12" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-white font-bold text-[14px]">
            Classificação — Grupo {grupo}
          </span>
          <div className="flex gap-4">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span key={col} className="text-[11px] font-bold text-white/30 w-5 text-center">{col}</span>
            ))}
          </div>
        </div>

        {/* Linhas */}
        {times.map((t, i) => (
          <div
            key={t.time.time_id}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: i < 2 ? "#5AADFF08" : "transparent",
              borderBottom: i < times.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  background: i === 0 ? "rgba(254,197,84,0.15)" : "rgba(255,255,255,0.06)",
                  color: i === 0 ? "#FEC554" : "rgba(255,255,255,0.4)",
                }}
              >
                {t.posicao}
              </span>
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.time.escudo} alt={t.time.sigla} className="w-5 h-5 object-contain" />
              </div>
              <span className="text-white font-bold text-[13px] tracking-wide">{t.time.sigla}</span>
            </div>
            <div className="flex gap-4">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map((val, vi) => (
                <span
                  key={vi}
                  className="w-5 text-center text-[13px] font-bold"
                  style={{ color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)" }}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>
        ))}

        {times.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-white/20 text-sm">Sem dados para este grupo</p>
          </div>
        )}
      </div>

      {/* Outros grupos */}
      {todosGrupos.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-white/30 tracking-widest uppercase mb-3">
            Grupos
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: Math.ceil(todosGrupos.length / 2) }, (_, ri) =>
              todosGrupos.slice(ri * 2, ri * 2 + 2)
            ).map((row, ri) => (
              <div key={ri} className="flex gap-2">
                {row.map(([key, rowTimes]) => {
                  const letra = key.replace("grupo-", "").toUpperCase();
                  const lider = rowTimes[0];
                  const ativo = letra === grupo;
                  if (!lider) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => onGrupo(letra)}
                      className="flex-1 flex items-center gap-2.5 px-3 py-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: ativo ? "rgba(255,175,47,0.08)" : "#0A0E19",
                        border: ativo ? "1px solid rgba(255,175,47,0.25)" : "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                        style={{
                          background: ativo ? "rgba(255,175,47,0.2)" : "rgba(255,255,255,0.07)",
                          color: ativo ? "#D4AF37" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {letra}
                      </span>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                        style={{ background: "rgba(255,255,255,0.9)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lider.time.escudo} alt={lider.time.sigla} className="w-5 h-5 object-contain" />
                      </div>
                      <span className="font-bold text-[12px] flex-1 truncate" style={{ color: ativo ? "#FFE8BA" : "#fff" }}>{lider.time.sigla}</span>
                      <span className="text-[11px] font-light" style={{ color: ativo ? "#D4AF37" : "rgba(255,255,255,0.35)" }}>Lidera</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Ranking ───────────────────────────────────────────────────
type RankingRowView = {
  pos: number;
  nome: string;
  iniciais: string;
  acertos: number;
  pts: number;
  exact: number;
  gols: number;
  isMe?: boolean;
};

type ResumoStats = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

type HistoricoRowView = {
  matchId: number;
  ticketId: string;
  bolaoType: "principal" | "diario";
  mandante: string;
  visitante: string;
  jogoData: string;
  jogoHora: string;
  palpiteCasa: number;
  palpiteVisitante: number;
  resultadoCasa: number | null;
  resultadoVisitante: number | null;
  pontos: number;
  exact: boolean;
  submittedAt: string;
  updatedAt: string;
};

export type PalpitesInitialData = {
  ticketId: string | null;
  bolaoType: "principal" | "diario";
  tabela: TabelaGrupos | null;
  jogos: Jogo[];
  grupos: string[];
  grupo: string;
  erro: boolean;
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>;
  rankingRows: RankingRowView[];
  resumoStats: ResumoStats;
  historicoRows: HistoricoRowView[];
};

function RankingMedal({ pos, size = 28 }: { pos: number; size?: number }) {
  if (pos === 1) return <TrophyGold size={size} />;
  if (pos === 2) return <TrophySilver size={size} />;
  if (pos === 3) return <TrophyBronze size={size} />;
  return <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>#{pos}</span>;
}

function RankingAvatar({ iniciais, isMe, size = 32 }: { iniciais: string; isMe?: boolean; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: isMe ? "rgba(218,182,130,0.15)" : "rgba(255,255,255,0.07)",
        color: isMe ? "#DAB682" : "rgba(255,255,255,0.5)",
        border: isMe ? "1px solid rgba(218,182,130,0.25)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {iniciais}
    </div>
  );
};


function RankingView({ rows, stats }: { rows: RankingRowView[]; stats: ResumoStats }) {
  const MEU = rows.find((r) => r.isMe) ?? rows[0] ?? { pos: 0, nome: "Você", iniciais: "VO", acertos: 0, pts: 0, exact: 0, gols: 0 };
  return (
    <div className="flex flex-col gap-3">

      {/* Minha posição */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{ background: "linear-gradient(135deg, #F6D13B2E 0%, #F1E8631F 100%)", border: "1px solid rgba(80,120,40,0.25)" }}
      >
        <p className="text-[10px] text-[#FFFFFF8C] font-bold tracking-widest uppercase mb-3">
          Sua posição atual
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <RankingAvatar iniciais={MEU.iniciais} isMe size={44} />
              <div
                className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#D4AF37" }}
              >
                <Coins className="w-2.5 h-2.5" style={{ color: "#0E141B" }} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <p className="text-white font-black text-[18px] leading-tight">#{MEU.pos} no Ranking</p>
              <p className="text-[12px] mt-0.5 text-[#FDF293]">
                {MEU.acertos} acertos · {MEU.pts} pontos
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-[34px] leading-none" style={{ color: "#FEE1A7" }}>{MEU.pts}</p>
            <p className="text-[10px] mt-0.5 text-[#FFFFFF59]">pontos</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { Icon: Target, val: stats.palpites, label: "Palpites", color: "#D4AF37" },
          { Icon: CircleCheck, val: stats.acertos, label: "Acertos", color: "#34D399" },
          { Icon: Star, val: stats.pontos, label: "Pontos", color: "#DAB682" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-2xl py-4 flex flex-col items-center gap-1"
            style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Icon className="w-5 h-5 mb-1" style={{ color }} strokeWidth={2} />
            <span className="text-white font-black text-[22px] leading-none">{val}</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[14px]">Top Palpiteiros</span>
          <button className="text-[13px] font-semibold" style={{ color: "#5AADFF" }}>Ver todos</button>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: r.isMe ? "rgba(90,173,255,0.06)" : "transparent",
              borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              <RankingMedal pos={r.pos} size={28} />
            </div>
            <RankingAvatar iniciais={r.iniciais} isMe={r.isMe} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[13px] truncate">
                {r.nome}
                {r.isMe && (
                  <span className="text-[11px] font-normal ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    (você)
                  </span>
                )}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.acertos} acertos</p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span
                className="font-black text-[16px]"
                style={{ color: r.isMe ? "#D4AF37" : "#fff" }}
              >
                {r.pts}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{ background: "rgba(218,182,130,0.06)", border: "1px solid rgba(218,182,130,0.18)" }}
      >
        <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#DAB682" }} strokeWidth={2} />
        <div>
          <p className="font-bold text-[13px]" style={{ color: "#DAB682" }}>Prazo para palpitar</p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "rgba(218,182,130,0.5)" }}>
            Os palpites são bloqueados 1 hora antes do início de cada partida. Não esqueça de salvar!
          </p>
        </div>
      </div>

    </div>
  );
}

function TicketPerforationLine() {
  return (
    <div className="relative h-3.5 shrink-0 w-full" aria-hidden>
      <div
        className="absolute left-0 top-1/2 z-1 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "var(--background)",
          boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.28)",
        }}
      />
      <div
        className="absolute right-0 top-1/2 z-1 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "var(--background)",
          boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.28)",
        }}
      />
      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 border-t border-dashed border-white/14" />
    </div>
  );
}

function TicketBarcodeMini() {
  const w = [2, 3, 2, 4, 2, 3, 2, 2, 4, 3, 2, 3, 2, 2, 4, 2, 3];
  return (
    <div className="flex items-end justify-center gap-[2px] h-6 opacity-45 mt-3" aria-hidden>
      {w.map((width, i) => (
        <span
          key={i}
          className="rounded-[1px] bg-white/35"
          style={{ width, height: i % 3 === 0 ? 20 : i % 2 === 0 ? 16 : 12 }}
        />
      ))}
    </div>
  );
}

function HistoricoSkeletonRows() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg px-3.5 py-3.5 animate-pulse"
          style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed rgba(212,175,55,0.2)" }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-white/10" />
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="h-7 w-7 rounded-full bg-white/10" />
            </div>
            <div className="h-5 w-16 rounded-full bg-white/10 shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="h-12 rounded-lg bg-white/5" />
            <div className="h-12 rounded-lg bg-white/5" />
          </div>
          <div className="h-8 rounded-lg bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function TicketResumoView({
  ticketId,
  resultMode,
  bolaoType,
  stats,
  rankingPos,
  historico,
  loadingHistorico,
  jogosById,
}: {
  ticketId: string | null;
  resultMode: boolean;
  bolaoType: "principal" | "diario";
  stats: ResumoStats;
  rankingPos: number | null;
  historico: HistoricoRowView[];
  loadingHistorico: boolean;
  jogosById: Record<number, Jogo>;
}) {
  const [resumoSecao, setResumoSecao] = useState<"geral" | "historico">("geral");

  return (
    <div
      className="relative rounded-[14px]"
      style={{
        border: "1px solid rgba(212,175,55,0.45)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        background: "linear-gradient(165deg, #121a2a 0%, #0A0E19 42%, #060912 100%)",
      }}
    >

      <div className="relative z-1 pl-[18px] pr-4 pt-4 pb-3 sm:pr-5 flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/45 font-mono leading-snug">
          {resultMode ? "Resumo do ticket (resultado)" : "Resumo do ticket"}
        </p>
        <span className="text-[8px] font-bold uppercase tracking-[0.28em] text-white/25 shrink-0 pt-0.5" aria-hidden>
          Ingresso
        </span>
      </div>

      <div className="relative z-1 px-4 pb-3 sm:px-5 sm:pb-3 -mt-0.5">
        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {ticketId && (
            <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(212,175,55,0.22)" }}>
              Ticket
              <p className="text-white font-semibold mt-0.5 truncate font-mono" title={ticketId}>{ticketId}</p>
            </div>
          )}
          {rankingPos != null && (
            <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(212,175,55,0.22)" }}>
              Ranking
              <p className="text-white font-semibold mt-0.5 font-mono">#{rankingPos}</p>
            </div>
          )}
          <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(34,197,94,0.08)", border: "1px dashed rgba(34,197,94,0.28)" }}>
            Pontos
            <p className="text-[#4ADE80] font-semibold mt-0.5 font-mono">{stats.pontos} pts</p>
          </div>
          <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(212,175,55,0.22)" }}>
            Acertos
            <p className="text-white font-semibold mt-0.5 font-mono">{stats.acertos}</p>
          </div>
          <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(212,175,55,0.22)" }}>
            Placar exato
            <p className="text-white font-semibold mt-0.5 font-mono">{stats.exatos}</p>
          </div>
          <div className="rounded-md px-2.5 py-2 text-[12px]" style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(212,175,55,0.22)" }}>
            Palpites
            <p className="text-white font-semibold mt-0.5 font-mono">{stats.palpites}</p>
          </div>
        </div>
      </div>

      <TicketPerforationLine />

      <div className="relative z-1 flex w-full overflow-hidden border-t border-white/6" style={{ background: "rgba(0,0,0,0.2)" }}>
        <button
          type="button"
          onClick={() => setResumoSecao("geral")}
          className="flex-1 py-3.5 px-2 text-[11px] font-bold font-mono uppercase tracking-wide transition-colors border-r border-dashed border-white/15"
          style={{
            background: resumoSecao === "geral" ? "rgba(212,175,55,0.1)" : "transparent",
            color: resumoSecao === "geral" ? "#FFE8BA" : "rgba(255,255,255,0.4)",
          }}
        >
          Resumo
        </button>
        <button
          type="button"
          onClick={() => setResumoSecao("historico")}
          className="flex-1 py-3.5 px-2 text-[11px] font-bold font-mono uppercase tracking-wide transition-colors"
          style={{
            background: resumoSecao === "historico" ? "rgba(212,175,55,0.1)" : "transparent",
            color: resumoSecao === "historico" ? "#FFE8BA" : "rgba(255,255,255,0.4)",
          }}
        >
          Histórico
        </button>
      </div>

      <TicketPerforationLine />

      <div
        className="relative z-1 px-4 pb-4 pt-3 sm:px-5"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.35) 100%)" }}
      >
      {resumoSecao === "geral" ? (
        <div className="text-[12px] leading-relaxed rounded-lg px-3 py-3" style={{ border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.15)" }}>
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-white/40 mb-2 font-mono">Informações</p>
          <ul className="space-y-2.5 text-white/75">
            <li className="flex justify-between gap-3">
              <span className="text-white/45 shrink-0">Bolão</span>
              <span className="text-right font-medium text-white/90">
                {bolaoType === "principal"
                  ? "Copa do Mundo 2026 — jogos do dia (Copa inteira)"
                  : "Copa do Mundo 2026 — jogos do dia"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-white/45 shrink-0">Regra</span>
              <span className="text-right font-medium text-white/90">
                {bolaoType === "principal"
                  ? "Ticket válido durante toda a Copa: todo dia você palpita em todos os jogos do dia."
                  : "Ticket diário: você palpita apenas nos jogos daquele dia."}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-white/45 shrink-0">Status do ticket</span>
              <span className="text-right font-medium text-white/90 font-mono">{resultMode ? "Resultado disponível" : "Em andamento"}</span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          {loadingHistorico ? (
            <HistoricoSkeletonRows />
          ) : historico.length === 0 ? (
            <div className="rounded-lg px-4 py-4 text-[12px] text-white/45 font-mono" style={{ border: "1px dashed rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.15)" }}>
              Nenhum palpite registrado ainda.
            </div>
          ) : (
            historico.map((item) => (
              (() => {
                const jogo = jogosById[item.matchId];
                return (
              <div
                key={`${item.matchId}-${item.submittedAt}`}
                className="rounded-lg px-3.5 py-3.5"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px dashed rgba(212,175,55,0.2)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {jogo?.escudoCasa ? (
                        <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={jogo.escudoCasa} alt={item.mandante} className="w-5 h-5 object-contain" />
                        </div>
                      ) : null}
                      <p className="text-[13px] font-bold text-white leading-snug">
                        {item.mandante} <span className="text-white/35 font-normal">vs</span> {item.visitante}
                      </p>
                      {jogo?.escudoVisitante ? (
                        <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={jogo.escudoVisitante} alt={item.visitante} className="w-5 h-5 object-contain" />
                        </div>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">{item.jogoData} · {item.jogoHora}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: item.resultadoCasa != null && item.resultadoVisitante != null ? "rgba(148,163,184,0.12)" : "rgba(34,197,94,0.12)",
                      color: item.resultadoCasa != null && item.resultadoVisitante != null ? "rgba(226,232,240,0.85)" : "#86EFAC",
                      border: `1px solid ${item.resultadoCasa != null && item.resultadoVisitante != null ? "rgba(148,163,184,0.25)" : "rgba(34,197,94,0.28)"}`,
                    }}
                  >
                    {item.resultadoCasa != null && item.resultadoVisitante != null ? "Encerrado" : "Aberto"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-white/40 font-bold uppercase tracking-wide">Palpite enviado em</p>
                    <p className="text-white/90 font-semibold mt-0.5">
                      {new Date(item.submittedAt).toLocaleDateString("pt-BR")} às {new Date(item.submittedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-white/40 font-bold uppercase tracking-wide">Jogo</p>
                    <p className="text-white/90 font-semibold mt-0.5">{item.jogoData}, {item.jogoHora}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                  <div>
                    <span className="text-white/40">Seu palpite</span>
                    <p className="font-black text-white mt-0.5">
                      {item.palpiteCasa} <span className="text-white/30 font-normal">x</span> {item.palpiteVisitante}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-white/10 hidden sm:block" />
                  <div>
                    <span className="text-white/40">Resultado</span>
                    <p className="font-black text-white mt-0.5">
                      {item.resultadoCasa ?? "-"} <span className="text-white/30 font-normal">x</span> {item.resultadoVisitante ?? "-"}
                    </p>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: item.pontos > 0 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)",
                        color: item.pontos > 0 ? "#86EFAC" : "rgba(255,255,255,0.45)",
                        border: `1px solid ${item.pontos > 0 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.1)"}`,
                      }}
                    >
                      {item.exact ? "Placar exato" : item.pontos > 0 ? "Acerto parcial" : "Sem pontos"}
                    </span>
                    <span className={`text-[13px] font-black ${item.pontos > 0 ? "text-[#4ADE80]" : "text-white/40"}`}>
                      {item.pontos > 0 ? `+${item.pontos} pts` : "0 pts"}
                    </span>
                  </div>
                </div>
              </div>
                );
              })()
            ))
          )}
        </div>
      )}
        <TicketBarcodeMini />
      </div>
    </div>
  );
}

// ── Sidebar desktop ───────────────────────────────────────────
function DesktopSidebar({ grupo, tabela, grupos, onGrupo, rankingRows, stats }: {
  grupo: string;
  tabela: TabelaGrupos | null;
  grupos: string[];
  onGrupo: (g: string) => void;
  rankingRows: RankingRowView[];
  stats: ResumoStats;
}) {
  const grupoKey = `grupo-${grupo.toLowerCase()}`;
  const times = tabela ? (tabela[grupoKey] ?? []) : [];
  const idx = grupos.indexOf(grupo);
  const prev = idx > 0 ? grupos[idx - 1] : null;
  const next = idx < grupos.length - 1 ? grupos[idx + 1] : null;

  return (
    <div className="flex flex-col gap-3 sticky top-6">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { Icon: Target, val: stats.palpites, label: "Palpites", color: "#D4AF37" },
          { Icon: CircleCheck, val: stats.acertos, label: "Acertos", color: "#34D399" },
          { Icon: Star, val: stats.pontos, label: "Pontos", color: "#DAB682" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-xl py-3 flex flex-col items-center gap-0.5"
            style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Icon className="w-4 h-4 mb-0.5" style={{ color }} strokeWidth={2} />
            <span className="text-white font-black text-[20px] leading-none">{val}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Classificação */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0A0E19", border: "1px solid #FFFFFF12" }}>
        <div
          className="flex items-center justify-between px-4 py-3 gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Seta prev */}
          <button
            onClick={() => prev && onGrupo(prev)}
            disabled={!prev}
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "rgba(255,255,255,0.06)", opacity: prev ? 1 : 0.25 }}
          >
            <ChevronDown className="w-3 h-3 text-white/60 rotate-90" />
          </button>

          {/* Título */}
          <span className="text-white font-bold text-[12px] flex-1 text-center truncate">
            Classificação — Grupo {grupo}
          </span>

          {/* Seta next */}
          <button
            onClick={() => next && onGrupo(next)}
            disabled={!next}
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "rgba(255,255,255,0.06)", opacity: next ? 1 : 0.25 }}
          >
            <ChevronDown className="w-3 h-3 text-white/60 -rotate-90" />
          </button>

          {/* Colunas */}
          <div className="flex gap-2 shrink-0">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span key={col} className="text-[9px] font-bold text-white/30 w-5 text-center">{col}</span>
            ))}
          </div>
        </div>

        {!tabela && (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}

        {times.map((t, i) => (
          <div
            key={t.time.time_id}
            className="flex items-center px-4 py-2.5 gap-2"
            style={{
              background: i < 2 ? "#5AADFF08" : "transparent",
              borderBottom: i < times.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {/* Posição */}
            <span
              className="w-5 h-5 rounded-[5px] flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                background: i === 0 ? "rgba(254,197,84,0.15)" : "rgba(255,255,255,0.06)",
                color: i === 0 ? "#FEC554" : "rgba(255,255,255,0.4)",
              }}
            >
              {t.posicao}
            </span>
            {/* Escudo */}
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: "rgba(255,255,255,0.92)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.time.escudo} alt={t.time.sigla} className="w-5 h-5 object-contain" />
            </div>
            {/* Sigla */}
            <span className="text-white font-bold text-[12px] flex-1 min-w-0 truncate">{t.time.sigla}</span>
            {/* Stats */}
            <div className="flex gap-2 shrink-0">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map((val, vi) => (
                <span
                  key={vi}
                  className="w-5 text-center text-[12px] font-bold"
                  style={{ color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)" }}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[13px]">Top Palpiteiros</span>
          <button className="text-[12px] font-semibold" style={{ color: "#5AADFF" }}>Ver todos</button>
        </div>
        {rankingRows.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{
              background: r.isMe ? "rgba(90,173,255,0.07)" : "transparent",
              borderBottom: i < rankingRows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {/* Medal / position */}
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <RankingMedal pos={r.pos} size={24} />
            </div>
            {/* Avatar */}
            <RankingAvatar iniciais={r.iniciais} isMe={r.isMe} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[12px] truncate">
                {r.nome}
                {r.isMe && (
                  <span className="text-[10px] font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>(você)</span>
                )}
              </p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.acertos} acertos</p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span className="font-black text-[14px]" style={{ color: r.isMe ? "#D4AF37" : "#fff" }}>{r.pts}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{ background: "rgba(218,182,130,0.06)", border: "1px solid rgba(218,182,130,0.18)" }}
      >
        <Bell className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DAB682" }} strokeWidth={2} />
        <div>
          <p className="font-bold text-[12px]" style={{ color: "#DAB682" }}>Prazo para palpitar</p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(218,182,130,0.5)" }}>
            Os palpites são bloqueados 1 hora antes do início de cada partida. Não esqueça de salvar!
          </p>
        </div>
      </div>

    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
function PalpitesPageContent({ initialData }: { initialData: PalpitesInitialData | null }) {
  const searchParams = useSearchParams();
  const resultMode = searchParams.get("mode") === "resultado";
  const ticketId = searchParams.get("ticket");
  const hasBoloesFlow = Boolean(ticketId);
  const [bolaoType, setBolaoType] = useState<"principal" | "diario">(initialData?.bolaoType ?? "principal");
  const [tab, setTab] = useState<TabView>("jogos");
  const [grupo, setGrupo] = useState(initialData?.grupo ?? "");
  const [jogos, setJogos] = useState<Jogo[]>(initialData?.jogos ?? []);
  const [grupos, setGrupos] = useState<string[]>(initialData?.grupos ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [erro, setErro] = useState(initialData?.erro ?? false);
  const [tabela, setTabela] = useState<TabelaGrupos | null>(initialData?.tabela ?? null);
  const [loadingTabela, setLoadingTabela] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTabView>("jogos");
  const [rankingRows, setRankingRows] = useState<RankingRowView[]>(initialData?.rankingRows ?? []);
  const [resumoStats, setResumoStats] = useState<ResumoStats>(initialData?.resumoStats ?? { palpites: 0, acertos: 0, pontos: 0, exatos: 0 });
  const [historicoRows, setHistoricoRows] = useState<HistoricoRowView[]>(initialData?.historicoRows ?? []);
  const [predictionsMap, setPredictionsMap] = useState<Record<number, { scoreCasa: number; scoreVisitante: number }>>(initialData?.predictionsMap ?? {});
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const showJogos = resultMode ? resultTab === "jogos" : tab === "jogos";
  const showRanking = resultMode ? resultTab === "ranking" : tab === "ranking";
  const showResumo = resultMode ? resultTab === "resumo" : tab === "resumo";
  const showPredictionsSkeleton =
    Boolean(ticketId) && loadingPredictions && Object.keys(predictionsMap).length === 0;

  useEffect(() => {
    if (initialData) {
      setLoading(false);
      setLoadingTabela(false);
      return;
    }
    setLoadingTabela(true);
    fetch("/api/tabela")
      .then((r) => r.json())
      .then((data) => {
        const fg = data?.["fase-de-grupos"];
        if (fg) setTabela(fg);
      })
      .catch(() => {})
      .finally(() => setLoadingTabela(false));

    fetch("/api/partidas")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        return { ok: r.ok, data };
      })
      .then(({ ok, data }) => {
        if (!ok) {
          setErro(true);
          return;
        }
        const fases = data?.partidas as Record<string, any> | undefined;
        const faseKey = fases?.["fase-de-grupos"] ? "fase-de-grupos" : (fases ? Object.keys(fases)[0] : undefined);
        const faseSelecionada = faseKey ? fases?.[faseKey] : null;
        if (!faseSelecionada || typeof faseSelecionada !== "object") {
          setJogos([]);
          setGrupos([]);
          setGrupo("GERAL");
          setErro(false);
          return;
        }

        const parsed = parsePartidas(faseSelecionada);
        setJogos(parsed);

        const letras = Object.keys(faseSelecionada)
          .filter((k) => k.startsWith("grupo-"))
          .map((k) => k.replace("grupo-", "").toUpperCase())
          .sort();
        setGrupos(letras);
        setGrupo(letras[0] ?? "GERAL");
        setErro(false);
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [initialData]);

  useEffect(() => {
    if (resultMode) setTab("jogos");
  }, [resultMode]);

  useEffect(() => {
    if (initialData && initialData.ticketId === ticketId) return;
    if (!ticketId) {
      setBolaoType("principal");
      return;
    }
    const prefix = inferBolaoTypeFromTicketPrefix(ticketId);
    if (prefix) setBolaoType(prefix);
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/tickets/bolao-type?ticketId=${encodeURIComponent(ticketId)}`,
          { credentials: "include", cache: "no-store" }
        );
        const d = (await r.json()) as { bolaoType?: string };
        const b = d.bolaoType === "diario" ? "diario" : "principal";
        if (!cancelled) setBolaoType(b);
      } catch {
        if (!cancelled) setBolaoType(prefix ?? "principal");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, initialData]);

  useEffect(() => {
    if (!ticketId) return;
    const hasServerPredictions =
      initialData &&
      initialData.ticketId === ticketId &&
      Object.keys(initialData.predictionsMap).length > 0;
    if (hasServerPredictions) return;
    (async () => {
      setLoadingPredictions(true);
      try {
        const r = await fetch(`/api/palpites?ticketId=${encodeURIComponent(ticketId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const d = (await r.json()) as { predictions?: Array<{ matchId: number; scoreCasa: number; scoreVisitante: number }> };
        if (!r.ok || !Array.isArray(d.predictions)) return;
        const next: Record<number, { scoreCasa: number; scoreVisitante: number }> = {};
        for (const p of d.predictions) {
          next[p.matchId] = { scoreCasa: p.scoreCasa, scoreVisitante: p.scoreVisitante };
        }
        setPredictionsMap(next);
      } catch {
        setPredictionsMap({});
      } finally {
        setLoadingPredictions(false);
      }
    })();
  }, [ticketId, initialData]);

  useEffect(() => {
    const hasServerRanking =
      initialData &&
      initialData.ticketId === ticketId &&
      initialData.rankingRows.length > 0;
    if (hasServerRanking) return;
    (async () => {
      try {
        const q = new URLSearchParams();
        if (ticketId) q.set("ticketId", ticketId);
        const r = await fetch(`/api/palpites/ranking?${q.toString()}`, { credentials: "include", cache: "no-store" });
        const d = (await r.json()) as { ranking?: Array<{ pos: number; ticketId: string; totalPoints: number; outcomeCount: number; exactCount: number; goalsCount: number; isMe: boolean }> };
        if (!r.ok || !Array.isArray(d.ranking)) return;
        setRankingRows(
          d.ranking.map((row) => ({
            pos: row.pos,
            nome: row.ticketId,
            iniciais: row.ticketId.slice(0, 2).toUpperCase(),
            acertos: row.outcomeCount,
            pts: row.totalPoints,
            exact: row.exactCount,
            gols: row.goalsCount,
            isMe: row.isMe,
          }))
        );
      } catch {}
    })();
  }, [bolaoType, ticketId, initialData]);

  useEffect(() => {
    if (!ticketId) return;
    const hasServerResumo =
      initialData &&
      initialData.ticketId === ticketId &&
      initialData.resumoStats.palpites >= 0;
    const hasServerHistorico =
      initialData &&
      initialData.ticketId === ticketId &&
      initialData.historicoRows.length > 0;
    if (hasServerResumo && hasServerHistorico) return;
    (async () => {
      setLoadingResumo(true);
      try {
        const q = new URLSearchParams({ ticketId });
        const [resumoResp, historicoResp] = await Promise.all([
          fetch(`/api/palpites/resumo?${q.toString()}`, { credentials: "include", cache: "no-store" }),
          fetch(`/api/palpites/historico?${q.toString()}&limit=30`, { credentials: "include", cache: "no-store" }),
        ]);
        const resumoData = (await resumoResp.json().catch(() => ({}))) as { resumo?: ResumoStats };
        const histData = (await historicoResp.json().catch(() => ({}))) as { historico?: HistoricoRowView[] };
        if (resumoResp.ok && resumoData.resumo) setResumoStats(resumoData.resumo);
        if (historicoResp.ok && Array.isArray(histData.historico)) setHistoricoRows(histData.historico);
      } finally {
        setLoadingResumo(false);
      }
    })();
  }, [ticketId, initialData]);

  const savePrediction = async (payload: { matchId: number; scoreCasa: number; scoreVisitante: number }) => {
    if (!ticketId) return;
    const isNewPrediction = !predictionsMap[payload.matchId];
    const r = await fetch("/api/palpites", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId,
        matchId: payload.matchId,
        scoreCasa: payload.scoreCasa,
        scoreVisitante: payload.scoreVisitante,
      }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error || "Falha ao salvar palpite");
    }
    setPredictionsMap((prev) => ({
      ...prev,
      [payload.matchId]: { scoreCasa: payload.scoreCasa, scoreVisitante: payload.scoreVisitante },
    }));
    if (isNewPrediction) {
      setResumoStats((prev) => ({ ...prev, palpites: prev.palpites + 1 }));
    }
  };

  useEffect(() => {
    if (resultMode) setResultTab("jogos");
  }, [resultMode]);

  const today = todayBR();
  const diarioPlayableDate = resolveDiarioPlayableDateFromJogos(jogos);
  const todayMs = brDateToUtcMs(today);
  const jogosBase = jogos.filter((j) => {
    const ms = brDateToUtcMs(j.dataBR);
    if (ms == null || todayMs == null) return true;
    if (bolaoType === "diario") return j.dataBR === diarioPlayableDate;
    return true;
  });
  const nowMs = Date.now();
  const diarioLockedMode =
    bolaoType === "diario" &&
    jogosBase.length > 0 &&
    jogosBase.every((j) => j.status === "encerrado" || isLockedByKickoff(j.kickoffAt, nowMs));
  const readOnlyMode = resultMode || diarioLockedMode;
  const jogosDisplayBase =
    bolaoType === "diario" && diarioLockedMode
      ? jogosBase.filter((j) => Boolean(predictionsMap[j.id]))
      : jogosBase;
  const shouldFilterByGroup = !hasBoloesFlow && grupos.length > 0;
  const matchesGroup = (j: Jogo) => (shouldFilterByGroup ? j.grupo === grupo : true);
  const rodadasDisponiveis = Array.from(new Set(jogosDisplayBase.filter((j) => matchesGroup(j)).map((j) => j.rodada))).sort((a, b) => a - b);
  const jogosPorRodada = rodadasDisponiveis.map((idx) => {
    const jogosDaRodada = jogosDisplayBase
      .filter((j) => matchesGroup(j) && j.rodada === idx);
    return {
      label: rodadaLabel(idx),
      jogos: jogosDaRodada,
    };
  });
  const showGroupedByGroup = hasBoloesFlow && bolaoType === "principal";
  const gruposComJogos = Array.from(new Set(jogosDisplayBase.map((j) => j.grupo).filter(Boolean))).sort();
  const jogosPorGrupoRodada = gruposComJogos.map((groupKey) => {
    const rodadasDoGrupo = Array.from(new Set(jogosDisplayBase.filter((j) => j.grupo === groupKey).map((j) => j.rodada))).sort((a, b) => a - b);
    return {
      groupKey,
      rodadas: rodadasDoGrupo.map((idx) => ({
        label: rodadaLabel(idx),
        jogos: jogosDisplayBase.filter((j) => j.grupo === groupKey && j.rodada === idx),
      })),
    };
  });
  const myRankingPos = rankingRows.find((row) => row.isMe)?.pos ?? null;
  const scrollToGroup = (groupKey: string) => {
    setGrupo(groupKey);
    if (typeof window === "undefined") return;
    const targetId = window.matchMedia("(min-width: 1024px)").matches ? `desk-group-${groupKey}` : `mob-group-${groupKey}`;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const jogosById = useMemo(
    () =>
      jogos.reduce((acc, j) => {
        acc[j.id] = j;
        return acc;
      }, {} as Record<number, Jogo>),
    [jogos]
  );

  const BotoesGrupo = ({ className }: { className?: string }) => (
    <div className={className}>
      <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase block mb-2">Grupo</span>
      {/* Mobile: chunked rows of 6 */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        {Array.from({ length: Math.ceil(grupos.length / 6) }, (_, ri) =>
          grupos.slice(ri * 6, ri * 6 + 6)
        ).map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((g) => (
              <button
                key={g}
                onClick={() => setGrupo(g)}
                className="flex-1 h-9 rounded-lg text-[13px] font-bold transition-all duration-200"
                style={{
                  background: grupo === g ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)" : "#0A0E19",
                  color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
                  boxShadow: grupo === g ? "0 0 14px rgba(255,175,47,0.45)" : "none",
                }}
              >{g}</button>
            ))}
          </div>
        ))}
      </div>
      {/* Desktop: single flex row */}
      <div className="hidden lg:flex gap-1.5 flex-wrap">
        {grupos.map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className="w-9 h-9 rounded-lg text-[13px] font-bold transition-all duration-200"
            style={{
              background: grupo === g ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)" : "#0A0E19",
              color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
              boxShadow: grupo === g ? "0 0 14px rgba(255,175,47,0.45)" : "none",
            }}
          >{g}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-8 lg:max-w-7xl">
      {hasBoloesFlow && (
        <div className="mb-4">
          <StepsBreadcrumb
            backHref={`/boloes`}
            items={["Bolões", "Tickets", "Palpites"]}
          />
        </div>
      )}

      {/* Background desktop — cobre a tela inteira */}
      <div
        className="fixed inset-0 pointer-events-none hidden lg:block -z-10"
        style={{
          backgroundImage: `url(${bgPalpitesDesk.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.07,
        }}
      />

      {/* Título */}
      <div className="mb-5 lg:mb-7">
        <h1 className="text-[28px] lg:text-[42px] font-black text-white leading-tight">
          Copa do Mundo 2026
        </h1>
        <p className="text-white/40 text-[13px] mt-1">
          {hasBoloesFlow
            ? bolaoType === "principal"
              ? "Jogos do dia · Copa inteira"
                  : "Jogos do dia atual"
            : "Fase de Grupos"}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

        {/* ── COLUNA ESQUERDA ─────────────────────────── */}
        <div>

          {/* Mobile: tabs */}
          {readOnlyMode ? (
            <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19]">
              {([
                { key: "jogos", label: "Jogos", icon: AlignJustify },
                { key: "ranking", label: "Ranking", icon: Trophy },
                { key: "resumo", label: "Resumo", icon: BarChart2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setResultTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: resultTab === key ? "#161D2D" : "transparent",
                    color: resultTab === key ? "#fff" : "rgba(255,255,255,0.35)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19]">
              {([
                { key: "jogos", label: "Jogos", icon: AlignJustify },
                { key: "tabela", label: "Tabela", icon: BarChart2 },
                { key: "ranking", label: "Ranking", icon: Trophy },
                { key: "resumo", label: "Resumo", icon: BarChart2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: tab === key ? "#161D2D" : "transparent",
                    color: tab === key ? "#fff" : "rgba(255,255,255,0.35)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Mobile: filtro grupos (exceto ranking) */}
          {grupos.length > 0 && tab !== "ranking" && tab !== "resumo" && !readOnlyMode && !hasBoloesFlow && (
            <div className="mb-5 lg:hidden">
              <BotoesGrupo />
            </div>
          )}

          {showGroupedByGroup && showJogos && (
            <div
              className="sticky top-[60px] lg:top-[60px] z-30 mb-5 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 border-y border-x-0"
              style={{
                background: "linear-gradient(180deg, rgba(10,14,25,0.96) 0%, rgba(10,14,25,0.92) 100%)",
                borderColor: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35 shrink-0 pr-1">Grupo</span>
                {gruposComJogos.map((g) => {
                  const active = grupo === g;
                  return (
                    <button
                      key={`tray-${g}`}
                      onClick={() => scrollToGroup(g)}
                      className="h-10 min-w-[40px] shrink-0 rounded-xl px-3 inline-flex items-center justify-center font-bold text-[13px] transition-all"
                      style={{
                        background: active ? "linear-gradient(180deg, #FFE8BA 0%, #FEC554 100%)" : "rgba(255,255,255,0.02)",
                        color: active ? "#0E141B" : "rgba(255,255,255,0.72)",
                        border: active ? "1px solid rgba(255,232,186,0.55)" : "1px solid rgba(255,255,255,0.1)",
                        boxShadow: active ? "0 1.85px 9.23px rgba(246,202,59,0.4)" : "none",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desktop: filtro de grupos */}
          {grupos.length > 0 && !readOnlyMode && !hasBoloesFlow && (
            <div className="hidden lg:block mb-6">
              <BotoesGrupo />
            </div>
          )}

          {/* Mobile: conteúdo com tabs — em resultMode NÃO usar tab==="jogos" (tab fica em jogos e quebrava o Ranking) */}
          <div key={readOnlyMode ? `result-${resultTab}` : tab} className="animate-tab-in lg:hidden">
            {showJogos && (
              <div>
                {erro ? (
                  <div className="flex flex-col items-center py-16">
                    <AlertTriangle className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                    <p className="text-white/30 text-sm">Erro ao carregar partidas</p>
                  </div>
                ) : loading || showPredictionsSkeleton ? (
                  <><CardSkeleton /><CardSkeleton /></>
                ) : jogosPorRodada.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <Disc className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                    <p className="text-white/30 text-sm">
                      {bolaoType === "diario" && diarioLockedMode
                        ? "Nenhum palpite encontrado para este ticket diário"
                        : hasBoloesFlow
                          ? "Nenhum jogo disponível hoje"
                          : "Nenhum jogo neste grupo"}
                    </p>
                  </div>
                ) : showGroupedByGroup ? (
                  jogosPorGrupoRodada.map(({ groupKey, rodadas }) => (
                    <div key={`group-${groupKey}`} id={`mob-group-${groupKey}`} className="scroll-mt-28">
                      <div className="flex items-center gap-3 mb-3 mt-2">
                        <span className="text-[11px] font-bold text-white/35 tracking-widest uppercase shrink-0">{`Grupo ${groupKey}`}</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                      </div>
                      {rodadas.map(({ label, jogos: rJogos }) => (
                        <div key={`${groupKey}-${label}`}>
                          <div className="flex items-center gap-3 mb-3 mt-1">
                            <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                          </div>
                          {rJogos.map((jogo) => (
                            <JogoCard
                              key={jogo.id}
                              jogo={jogo}
                              readOnly={readOnlyMode}
                              ticketId={ticketId}
                              initialPrediction={predictionsMap[jogo.id] ?? null}
                              predictionsLoading={loadingPredictions}
                              onSavePrediction={savePrediction}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  jogosPorRodada.map(({ label, jogos: rJogos }) => (
                    <div key={label}>
                      <div className="flex items-center gap-3 mb-3 mt-1">
                        <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                      </div>
                      {rJogos.map((jogo) => (
                        <JogoCard
                          key={jogo.id}
                          jogo={jogo}
                          readOnly={readOnlyMode}
                          ticketId={ticketId}
                          initialPrediction={predictionsMap[jogo.id] ?? null}
                          predictionsLoading={loadingPredictions}
                          onSavePrediction={savePrediction}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
            {tab === "tabela" && !readOnlyMode && (
              <TabelaView grupo={grupo} tabela={tabela} onGrupo={setGrupo} loading={loadingTabela} />
            )}
            {showRanking ? <RankingView rows={rankingRows} stats={resumoStats} /> : null}
            {showResumo ? (
              <TicketResumoView
                ticketId={ticketId}
                resultMode={resultMode}
                bolaoType={bolaoType}
                stats={resumoStats}
                rankingPos={myRankingPos}
                historico={historicoRows}
                loadingHistorico={loadingResumo}
                jogosById={jogosById}
              />
            ) : null}
          </div>

          {/* Desktop: grid 2 colunas de cards por rodada */}
          <div className="hidden lg:block">
            {readOnlyMode && (
              <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19] w-[280px]">
                {([
                  { key: "jogos", label: "Jogos", icon: AlignJustify },
                  { key: "ranking", label: "Ranking", icon: Trophy },
                  { key: "resumo", label: "Resumo", icon: BarChart2 },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setResultTab(key)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                    style={{
                      background: resultTab === key ? "#161D2D" : "transparent",
                      color: resultTab === key ? "#fff" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {showResumo ? (
              <TicketResumoView
                ticketId={ticketId}
                resultMode={resultMode}
                bolaoType={bolaoType}
                stats={resumoStats}
                rankingPos={myRankingPos}
                historico={historicoRows}
                loadingHistorico={loadingResumo}
                jogosById={jogosById}
              />
            ) : showRanking ? (
              <RankingView rows={rankingRows} stats={resumoStats} />
            ) : erro ? (
              <div className="flex flex-col items-center py-16">
                <AlertTriangle className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                <p className="text-white/30 text-sm">Erro ao carregar partidas</p>
              </div>
            ) : loading || showPredictionsSkeleton ? (
              <div className="grid grid-cols-2 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : jogosPorRodada.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Disc className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                <p className="text-white/30 text-sm">
                  {bolaoType === "diario" && diarioLockedMode
                    ? "Nenhum palpite encontrado para este ticket diário"
                    : hasBoloesFlow
                      ? "Nenhum jogo disponível hoje"
                      : "Nenhum jogo neste grupo"}
                </p>
              </div>
            ) : showGroupedByGroup ? (
              jogosPorGrupoRodada.map(({ groupKey, rodadas }) => (
                <div key={`desk-group-${groupKey}`} id={`desk-group-${groupKey}`} className="mb-6 scroll-mt-28">
                  <div className="flex items-center gap-3 mb-4 mt-1">
                    <span className="text-[11px] font-bold text-white/35 tracking-widest uppercase shrink-0">{`Grupo ${groupKey}`}</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                  </div>
                  {rodadas.map(({ label, jogos: rJogos }) => (
                    <div key={`desk-${groupKey}-${label}`} className="mb-5">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {rJogos.map((jogo) => (
                          <JogoCard
                            key={jogo.id}
                            jogo={jogo}
                            readOnly={readOnlyMode}
                            ticketId={ticketId}
                            initialPrediction={predictionsMap[jogo.id] ?? null}
                            predictionsLoading={loadingPredictions}
                            onSavePrediction={savePrediction}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              jogosPorRodada.map(({ label, jogos: rJogos }) => (
                <div key={label} className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {rJogos.map((jogo) => (
                      <JogoCard
                        key={jogo.id}
                        jogo={jogo}
                        readOnly={readOnlyMode}
                        ticketId={ticketId}
                        initialPrediction={predictionsMap[jogo.id] ?? null}
                        predictionsLoading={loadingPredictions}
                        onSavePrediction={savePrediction}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ── SIDEBAR DIREITA (desktop only) ───────────── */}
        {!readOnlyMode && (
          <div className="hidden lg:block">
            <DesktopSidebar
              grupo={grupo}
              tabela={tabela}
              grupos={grupos}
              onGrupo={setGrupo}
              rankingRows={rankingRows}
              stats={resumoStats}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default function PalpitesClient({ initialData }: { initialData: PalpitesInitialData | null }) {
  return (
    <Suspense fallback={<PalpitesPageShell />}>
      <PalpitesPageContent initialData={initialData} />
    </Suspense>
  );
}

function PalpitesPageShell() {
  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-8 lg:max-w-7xl">
      <div className="mb-5 lg:mb-7">
        <div className="h-10 w-64 rounded-xl bg-white/10" />
        <div className="h-4 w-40 rounded mt-2 bg-white/10" />
      </div>
      <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19]">
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
