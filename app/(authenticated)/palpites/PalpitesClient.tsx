"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
  Trophy,
  AlignJustify,
  Target,
  CircleCheck,
  Star,
  Bell,
  Coins,
  AlertTriangle,
  Disc,
  Pencil,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
} from "lucide-react";
import {
  TrophyGold,
  TrophySilver,
  TrophyBronze,
} from "@/app/components/RankingTrophies";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";
import { calcPredictionPoints } from "./lib/predictionsStorage";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind";
import {
  matchDateMapFromJogos,
  matchDateMapFromJogosWithCompetition,
  resolveDiarioPlayableDate,
} from "@/lib/diario-playable-date";
import {
  parseKickoffFromPartidaPayload,
  pickScoreFromPartidaPayload,
} from "@/lib/partida-placar";
import {
  palpiteLockBeforeKickoffMs,
  type PredictionBolaoType,
} from "@/lib/palpites-kickoff-lock";

// ── Tipos ────────────────────────────────────────────────────
type TabView = "jogos" | "tabela" | "ranking" | "resumo";
type ResultTabView = "jogos" | "ranking" | "resumo";
type StatusJogo = "aberto" | "encerrado";

interface ClassificacaoTime {
  posicao: number;
  pontos: number;
  time: {
    time_id: number;
    nome_popular: string;
    sigla: string;
    escudo: string;
  };
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
  /** Texto cru da API (andamento, intervalo, finalizado, …). */
  statusBruto: string;
  /** 1 ou 2 quando a API informa o tempo regulamentar. */
  liveTempo: number | null;
  /** Minuto de jogo quando a API informa (ou minuto acumulado). */
  liveMinuto: number | null;
  grupo: string;
  rodada: number;
  dataBR: string;
  kickoffAt: string | null;
  resultCasa: number | null;
  resultVisitante: number | null;
}

// ── Helpers ──────────────────────────────────────────────────
const MESES = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];
function rodadaLabel(idx: number): string {
  return `${idx + 1}ª Rodada`;
}

function formatData(dataStr?: string | null, isoStr?: string | null): string {
  const normalized = String(dataStr ?? "").trim();
  if (
    normalized &&
    normalized !== "undefined" &&
    normalized !== "null" &&
    normalized.includes("/")
  ) {
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
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function brDateToUtcMs(dateBR: string): number | null {
  const [d, m, y] = dateBR.split("/");
  if (!d || !m || !y) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year)
  )
    return null;
  return Date.UTC(year, month - 1, day);
}

function isLockedByKickoff(
  kickoffAt: string | null | undefined,
  nowMs: number,
  bolaoType: PredictionBolaoType,
): boolean {
  if (!kickoffAt) return false;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (!Number.isFinite(kickoffMs)) return false;
  const lead = palpiteLockBeforeKickoffMs(bolaoType);
  return nowMs >= kickoffMs - lead;
}

function palpiteLockUiCopy(bolaoType: PredictionBolaoType): {
  fechadoJaPassou: string;
  faixaForaPrazo: string;
  rankingBloco: string;
} {
  if (bolaoType === "extra") {
    return {
      fechadoJaPassou: "Fechado: prazo era até 5 min antes do jogo",
      faixaForaPrazo:
        "O prazo termina 5 minutos antes do apito. Depois disso não dá para apostar. Se você não tiver salvo um palpite antes desse horário, não entra nesta partida.",
      rankingBloco:
        "Palpites só até 5 minutos antes do apito: após esse limite e após o início o sistema fecha. Quem não tiver palpite salvo até esse horário não entra na partida.",
    };
  }
  return {
    fechadoJaPassou: "Fechado: prazo era ate 1h antes do jogo",
    faixaForaPrazo:
      "O prazo termina 1 hora antes do apito. Depois disso não dá para apostar. Se você não tiver salvo um palpite antes desse horário, não entra nesta partida.",
    rankingBloco:
      "Palpites so ate 1h antes do apito: na ultima hora antes do jogo e depois do inicio o sistema fecha. Quem nao tiver palpite salvo ate esse limite nao entra na partida.",
  };
}

function kickoffMsFromJogo(jogo: Jogo): number | null {
  if (!jogo.kickoffAt) return null;
  const t = new Date(jogo.kickoffAt).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Partida com apito ja dado e ainda sem encerramento oficial (somente leitura / UX). */
function isMatchLiveForDisplay(jogo: Jogo, nowMs: number): boolean {
  const ko = kickoffMsFromJogo(jogo);
  if (ko == null || nowMs < ko) return false;
  if (jogo.resultCasa != null && jogo.resultVisitante != null) return false;
  if (jogo.status === "encerrado") return false;
  const raw = String(jogo.statusBruto ?? jogo.status ?? "").toLowerCase();
  if (raw.includes("encerr") || raw.includes("finaliz")) return false;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLiveTempoFromPartida(p: any): number | null {
  const v = p?.tempo ?? p?.tempo_partida ?? p?.numero_tempo;
  if (v === 1 || v === "1") return 1;
  if (v === 2 || v === "2") return 2;
  const s = String(v ?? "").toUpperCase();
  if (s.includes("PRIMEIRO") && s.includes("TEMPO")) return 1;
  if (s.includes("SEGUNDO") && s.includes("TEMPO") && !s.includes("PRIMEIRO"))
    return 2;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLiveMinutoFromPartida(p: any): number | null {
  const tryNum = (x: unknown): number | null => {
    if (typeof x === "number" && Number.isFinite(x))
      return Math.max(0, Math.min(125, Math.trunc(x)));
    if (typeof x === "string") {
      const t = x.trim();
      if (!t) return null;
      if (/^\d{1,3}$/.test(t))
        return Math.max(0, Math.min(125, parseInt(t, 10)));
      const head = t.split(":")[0];
      if (head && /^\d{1,3}$/.test(head))
        return Math.max(0, Math.min(125, parseInt(head, 10)));
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

/** Ao vivo: texto ao lado da data (1º/2º tempo, minutos, intervalo). */
function formatLiveClockLabel(jogo: Jogo, nowMs: number): string | null {
  if (!isMatchLiveForDisplay(jogo, nowMs)) return null;
  const raw = (jogo.statusBruto ?? "").toLowerCase();
  if (raw.includes("intervalo")) return "Intervalo";

  const t = jogo.liveTempo;
  const mApi = jogo.liveMinuto;
  if (t != null && mApi != null) return `${t}º tempo · ${mApi} min`;
  if (mApi != null) {
    const half = mApi <= 45 ? "1º tempo" : "2º tempo";
    return `${half} · ${mApi} min`;
  }

  const ko = kickoffMsFromJogo(jogo);
  if (ko == null) return "Ao vivo";
  const wall = Math.max(0, Math.floor((nowMs - ko) / 60_000));
  if (wall <= 52) return `1º tempo · ${Math.min(wall, 50)} min`;
  if (wall < 62) return "Intervalo";
  return `2º tempo · ${Math.min(wall - 61, 99)} min`;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePartidas(faseData: Record<string, any>): Jogo[] {
  const jogos: Jogo[] = [];
  const grupoKeys = Object.keys(faseData).filter(
    (k) => typeof faseData[k] === "object" && !Array.isArray(faseData[k]),
  );
  const rodadaDiretaKeys = Object.keys(faseData).filter((k) =>
    Array.isArray(faseData[k]),
  );

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
          rodada: rodadaIndex,
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
    const rodadaKeys = Object.keys(grupoData ?? {}).filter((k) =>
      Array.isArray(grupoData[k]),
    );

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
          statusBruto: String(p.status ?? ""),
          liveTempo: parseLiveTempoFromPartida(p),
          liveMinuto: parseLiveMinutoFromPartida(p),
          status: mapStatus(String(p.status ?? "")),
          grupo: grupoLetra,
          rodada: rodadaIndex,
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
  jogos: Jogo[];
  grupos: string[];
} {
  if (!fases || typeof fases !== "object") return { jogos: [], grupos: [] };
  const phaseValues = Object.values(fases).filter(
    (value) => value && typeof value === "object",
  ) as Record<string, any>[];
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

function pickTabelaGrupos(data: any): TabelaGrupos | null {
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
      Object.keys(value as Record<string, unknown>).some((key) =>
        key.startsWith("grupo-"),
      ),
  );
  return (firstGrouped as TabelaGrupos) ?? null;
}

// ── Escudo do time ────────────────────────────────────────────
function Escudo({
  url,
  alt,
  size = "md",
}: {
  url: string;
  alt: string;
  size?: "sm" | "md" | "lg";
}) {
  const imgSize =
    size === "sm" ? "w-12 h-12" : size === "lg" ? "w-16 h-16" : "w-14 h-14";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={`${imgSize} object-contain shrink-0 drop-shadow-sm`}
    />
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden mb-3 bg-[#0B0D0C] border border-primary/15 animate-pulse">
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
    <div className="h-9 w-9 overflow-hidden relative flex items-center justify-center">
      <span
        key={value}
        className={`text-white font-black text-[32px] leading-none absolute ${dir === "up" ? "animate-score-up" : "animate-score-down"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Card do jogo ──────────────────────────────────────────────

/** Texto do rodapé após jogo com placar e palpite (regras iguais ao calcPredictionPoints). */
function copyPontuacaoPartida(
  review: ReturnType<typeof calcPredictionPoints>,
  predCasa: number,
  predVis: number,
  realCasa: number,
  realVis: number,
): { title: string; subtitle?: string; tone: "win" | "partial" | "miss" } {
  if (review.exact) {
    return {
      title: `Placar exato: +${review.points} pontos`,
      subtitle:
        "Você acertou quantos gols o time da casa fez e quantos o visitante fez.",
      tone: "win",
    };
  }
  if (review.outcomeHit) {
    const subtitle =
      review.goalsHitCount >= 1
        ? "Você acertou quem venceu ou se empatou, e também acertou um dos números do placar."
        : "Você acertou quem venceu ou se o jogo terminou empatado.";
    return {
      title: `Resultado do jogo certo: +${review.points} pontos`,
      subtitle,
      tone: "win",
    };
  }
  if (review.points > 0) {
    const subtitle =
      predCasa === realCasa && predVis !== realVis
        ? "Só o número de gols do time da casa estava igual ao jogo."
        : predVis === realVis && predCasa !== realCasa
          ? "Só o número de gols do visitante estava igual ao jogo."
          : "Parte do placar bateu com o jogo.";
    return {
      title: `Você ganhou ${review.points} ponto${review.points > 1 ? "s" : ""} nesta partida`,
      subtitle,
      tone: "partial",
    };
  }
  return {
    title: "Nenhum ponto nesta partida",
    subtitle: `O jogo terminou ${realCasa} a ${realVis}. Você tinha colocado ${predCasa} a ${predVis}.`,
    tone: "miss",
  };
}

function JogoCard({
  jogo,
  readOnly = false,
  ticketId,
  initialPrediction,
  predictionsLoading = false,
  bolaoType,
  onSavePrediction,
}: {
  jogo: Jogo;
  readOnly?: boolean;
  ticketId: string | null;
  initialPrediction?: { scoreCasa: number; scoreVisitante: number } | null;
  predictionsLoading?: boolean;
  bolaoType: PredictionBolaoType;
  onSavePrediction?: (payload: {
    matchId: number;
    scoreCasa: number;
    scoreVisitante: number;
  }) => Promise<void>;
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

  const lockLeadMs = palpiteLockBeforeKickoffMs(bolaoType);
  const lockUi = palpiteLockUiCopy(bolaoType);
  const lockAtMs = jogo.kickoffAt
    ? new Date(jogo.kickoffAt).getTime() - lockLeadMs
    : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    if (lockAtMs != null) {
      const msUntilLock = lockAtMs - Date.now();
      const interval = msUntilLock < 2 * 60 * 1000 ? 1000 : 30_000;
      const id = setInterval(tick, interval);
      return () => clearInterval(id);
    }
    if (jogo.kickoffAt) {
      const id = setInterval(tick, 60_000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [lockAtMs, jogo.kickoffAt]);
  const isLockedByTime = lockAtMs != null ? nowMs >= lockAtMs : false;
  /** Palpite até instantes antes do apito (1h no geral/dia, 5 min no extra). */
  const canEdit = !readOnly && jogo.status === "aberto" && !isLockedByTime;

  function formatTimeUntilLock(): string {
    if (!lockAtMs) return "Aberto";
    const diff = lockAtMs - nowMs;
    if (diff <= 0) return "Fechado";
    const totalSecs = Math.floor(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days >= 2) return `Fecha em ${days}d`;
    if (days === 1) return `Fecha em 1 dia`;
    if (hours >= 2) return `Fecha em ${hours}h`;
    if (mins >= 1) {
      const remMins = mins % 60;
      if (hours >= 1) return `Fecha em ${hours}h ${remMins}m`;
      return `Fecha em ${mins}m`;
    }
    return `Fecha em ${totalSecs}s`;
  }

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

  const disabled =
    readOnly || !canEdit || palpiteSalvo || isSubmitting || predictionsLoading;
  const hasInitialPrediction = Boolean(initialPrediction);

  const temPlacarOficial =
    jogo.resultCasa != null && jogo.resultVisitante != null;
  const displayCasa =
    readOnly && temPlacarOficial ? jogo.resultCasa! : scoreCasa;
  const displayVisitante =
    readOnly && temPlacarOficial ? jogo.resultVisitante! : scoreVisitante;
  const review =
    readOnly && temPlacarOficial && hasInitialPrediction
      ? calcPredictionPoints(
          scoreCasa,
          scoreVisitante,
          jogo.resultCasa!,
          jogo.resultVisitante!,
        )
      : null;

  const koMs = kickoffMsFromJogo(jogo);
  const beforeKickoff = koMs != null && nowMs < koMs;
  const matchLive = isMatchLiveForDisplay(jogo, nowMs);
  const liveClockLabel = formatLiveClockLabel(jogo, nowMs);
  /** Antes do apito: qualquer jogo na rodada (nao so o primeiro da lista). */
  const readOnlyPending = readOnly && beforeKickoff;
  const readOnlyMatchLive = readOnly && matchLive;
  const readOnlyPlacarPendente =
    readOnly &&
    !readOnlyPending &&
    !readOnlyMatchLive &&
    !temPlacarOficial &&
    jogo.status === "encerrado";
  const resultadoResumo =
    readOnly &&
    temPlacarOficial &&
    hasInitialPrediction &&
    review &&
    !readOnlyPending &&
    !readOnlyMatchLive &&
    !readOnlyPlacarPendente
      ? copyPontuacaoPartida(
          review,
          scoreCasa,
          scoreVisitante,
          jogo.resultCasa!,
          jogo.resultVisitante!,
        )
      : null;

  // Status badge label/style
  const statusBadge = readOnly
    ? readOnlyPending
      ? {
          label: "Aguardando jogo",
          color: "#E8C840",
          bg: "rgba(232,200,64,0.12)",
          border: "rgba(232,200,64,0.38)",
          dot: true,
        }
      : readOnlyMatchLive
        ? {
            label: "Em andamento",
            color: "#B1EB0B",
            bg: "rgba(177,235,11,0.10)",
            border: "rgba(177,235,11,0.30)",
            dot: true,
          }
        : readOnlyPlacarPendente
          ? {
              label: "Placar pendente",
              color: "#E8C840",
              bg: "rgba(232,200,64,0.12)",
              border: "rgba(232,200,64,0.38)",
              dot: true,
            }
          : {
              label: "Resultado",
              color: "#B1EB0B",
              bg: "rgba(177,235,11,0.10)",
              border: "rgba(177,235,11,0.30)",
              dot: false,
            }
    : jogo.status === "encerrado"
      ? {
          label: "Encerrado",
          color: "rgba(255,255,255,0.30)",
          bg: "transparent",
          border: "rgba(255,255,255,0.08)",
          dot: false,
        }
      : palpiteSalvo
        ? {
            label: "Salvo",
            color: "#B1EB0B",
            bg: "rgba(177,235,11,0.10)",
            border: "rgba(177,235,11,0.34)",
            dot: true,
          }
        : isLockedByTime
          ? {
              label: "Fechado",
              color: "rgba(255,255,255,0.40)",
              bg: "rgba(255,255,255,0.06)",
              border: "rgba(255,255,255,0.10)",
              dot: false,
            }
          : {
              label: formatTimeUntilLock(),
              color: "#B1EB0B",
              bg: "rgba(177,235,11,0.10)",
              border: "rgba(177,235,11,0.34)",
              dot: true,
            };

  // Horizontal stepper — áreas de toque maiores (acessibilidade)
  const HorizStepper = ({
    value,
    onInc,
    onDec,
  }: {
    value: number;
    onInc: () => void;
    onDec: () => void;
  }) => (
    <div className="mt-3 flex items-center gap-2.5">
      <button
        type="button"
        onClick={onDec}
        disabled={disabled}
        aria-label="Diminuir gols"
        className="min-h-11 min-w-11 h-11 w-11 rounded-lg flex items-center justify-center transition-opacity"
        style={{
          opacity: disabled ? 0.3 : 1,
          background: "#111411",
          border: "1px solid rgba(177,235,11,0.2)",
        }}
      >
        <ChevronDown className="w-5 h-5 text-primary" aria-hidden />
      </button>
      <span className="min-w-10 text-center text-[26px] font-black text-white tabular-nums leading-none">
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={disabled}
        aria-label="Aumentar gols"
        className="min-h-11 min-w-11 h-11 w-11 rounded-lg flex items-center justify-center transition-opacity"
        style={{
          opacity: disabled ? 0.3 : 1,
          background: "#111411",
          border: "1px solid rgba(177,235,11,0.2)",
        }}
      >
        <ChevronUp className="w-5 h-5 text-primary" aria-hidden />
      </button>
    </div>
  );

  const cardBorder = readOnly
    ? readOnlyPending
      ? "rgba(232,200,64,0.55)"
      : readOnlyPlacarPendente
        ? "rgba(232,200,64,0.42)"
        : readOnlyMatchLive
          ? "rgba(177,235,11,0.48)"
          : resultadoResumo?.tone === "win" && review?.exact
            ? "rgba(177,235,11,0.52)"
            : resultadoResumo?.tone === "win"
              ? "rgba(177,235,11,0.34)"
              : resultadoResumo?.tone === "partial"
                ? "rgba(177,235,11,0.22)"
                : resultadoResumo?.tone === "miss"
                  ? "rgba(255,255,255,0.11)"
                  : "rgba(177,235,11,0.15)"
    : palpiteSalvo
      ? "rgba(177,235,11,0.60)"
      : "rgba(177,235,11,0.15)";
  const cardShadow = readOnly
    ? readOnlyPending
      ? "0 0 0 1px rgba(232,200,64,0.10), 0 4px 18px rgba(0,0,0,0.32), 0 0 14px rgba(232,200,64,0.08)"
      : readOnlyPlacarPendente
        ? "0 0 0 1px rgba(232,200,64,0.10), 0 4px 18px rgba(0,0,0,0.32), 0 0 12px rgba(232,200,64,0.06)"
        : readOnlyMatchLive
          ? "0 0 0 1px rgba(177,235,11,0.12), 0 8px 24px rgba(0,0,0,0.40), 0 0 18px rgba(177,235,11,0.12)"
          : resultadoResumo?.tone === "win" && review?.exact
            ? "0 0 0 1px rgba(177,235,11,0.14), 0 8px 28px rgba(0,0,0,0.38), 0 0 22px rgba(177,235,11,0.18)"
            : resultadoResumo?.tone === "win"
              ? "0 0 0 1px rgba(177,235,11,0.10), 0 6px 22px rgba(0,0,0,0.34), 0 0 16px rgba(177,235,11,0.10)"
              : "0 4px 16px rgba(0,0,0,0.28)"
    : palpiteSalvo
      ? "0 0 0 1px rgba(177,235,11,0.12), 0 8px 24px rgba(0,0,0,0.40), 0 0 18px rgba(177,235,11,0.12)"
      : "0 4px 16px rgba(0,0,0,0.28)";

  return (
    <div
      className="rounded-xl overflow-hidden mb-4 bg-[#0B0D0C]"
      style={{
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
      }}
    >
      {/* ── Top bar: status + date (tipografia maior, contraste alto) ── */}
      <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-1">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full shrink-0"
          style={{
            background: statusBadge.bg,
            border: `1px solid ${statusBadge.border}`,
          }}
        >
          {statusBadge.dot && (
            <span
              className="w-2 h-2 rounded-full animate-pulse shrink-0"
              style={{ background: statusBadge.color }}
              aria-hidden
            />
          )}
          <span
            className="text-sm font-semibold leading-tight tracking-normal"
            style={{ color: statusBadge.color }}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="flex flex-col items-end justify-start gap-1 text-right min-w-0 flex-1">
          <span
            className="text-sm font-medium leading-snug"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {formatData(jogo.dataBR, jogo.kickoffAt)},{" "}
            {safeHourLabel(jogo.hora)}
          </span>
          {liveClockLabel ? (
            <span
              className="text-sm font-bold leading-snug text-pretty sm:whitespace-nowrap"
              style={{ color: "#B1EB0B" }}
            >
              {liveClockLabel}
            </span>
          ) : null}
        </div>
      </div>

      {readOnly && temPlacarOficial ? (
        <p
          className="px-4 sm:px-5 pt-1 pb-0.5 text-center text-base font-semibold leading-snug"
          style={{ color: "rgba(255,255,255,0.82)" }}
        >
          Placar oficial do jogo
        </p>
      ) : null}

      {/* ── Times + placar ── */}
      <div className="flex items-end px-4 sm:px-5 py-4 gap-2">
        <div className="flex flex-1 flex-col items-center min-w-0">
          <Escudo
            url={jogo.escudoCasa}
            alt={jogo.timeCasa}
            size={readOnly ? "lg" : "md"}
          />
          <p className="mt-3 text-[15px] sm:text-base font-semibold text-white text-center leading-snug line-clamp-2 px-0.5">
            {jogo.timeCasa}
          </p>
          {readOnly ? (
            <div
              className="mt-3 min-h-13 min-w-13 px-2 rounded-xl flex items-center justify-center text-[1.75rem] sm:text-[2rem] font-black tabular-nums leading-none"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
              aria-label={`Gols ${jogo.timeCasa}: ${displayCasa}`}
            >
              {displayCasa}
            </div>
          ) : predictionsLoading ? (
            <div
              className="mt-3 h-11 w-28 rounded-full animate-pulse"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          ) : (
            <HorizStepper
              value={scoreCasa}
              onInc={() => increment("casa")}
              onDec={() => decrement("casa")}
            />
          )}
        </div>

        <svg
          className="mb-2 shrink-0 opacity-95"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>

        <div className="flex flex-1 flex-col items-center min-w-0">
          <Escudo
            url={jogo.escudoVisitante}
            alt={jogo.timeVisitante}
            size={readOnly ? "lg" : "md"}
          />
          <p className="mt-3 text-[15px] sm:text-base font-semibold text-white text-center leading-snug line-clamp-2 px-0.5">
            {jogo.timeVisitante}
          </p>
          {readOnly ? (
            <div
              className="mt-3 min-h-13 min-w-13 px-2 rounded-xl flex items-center justify-center text-[1.75rem] sm:text-[2rem] font-black tabular-nums leading-none"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
              aria-label={`Gols ${jogo.timeVisitante}: ${displayVisitante}`}
            >
              {displayVisitante}
            </div>
          ) : predictionsLoading ? (
            <div
              className="mt-3 h-11 w-28 rounded-full animate-pulse"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          ) : (
            <HorizStepper
              value={scoreVisitante}
              onInc={() => increment("visitante")}
              onDec={() => decrement("visitante")}
            />
          )}
        </div>
      </div>

      {readOnly && temPlacarOficial && hasInitialPrediction ? (
        <div className="px-4 sm:px-5 pb-3">
          <section
            className="rounded-xl px-4 py-4"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            aria-label="Seu palpite em relação ao resultado do jogo"
          >
            <p
              className="text-sm sm:text-[15px] leading-relaxed text-center font-medium mb-3"
              style={{ color: "rgba(255,255,255,0.82)" }}
            >
              Os números grandes acima mostram como o jogo terminou. Aqui está o
              que você tinha escolhido.
            </p>
            <p className="text-base font-bold text-center text-white mb-3">
              Seu palpite
            </p>
            <div className="flex flex-col items-center justify-center gap-3">
              <div
                className="flex items-center justify-center gap-2.5"
                role="group"
                aria-label="Placar do seu palpite"
              >
                <span
                  className="min-w-12 min-h-12 h-12 px-2 rounded-xl flex items-center justify-center text-2xl sm:text-[1.65rem] font-black tabular-nums"
                  style={{
                    background:
                      scoreCasa === jogo.resultCasa
                        ? "rgba(177,235,11,0.22)"
                        : "rgba(255,255,255,0.08)",
                    color:
                      scoreCasa === jogo.resultCasa
                        ? "#D4F862"
                        : "rgba(255,255,255,0.92)",
                    border: `2px solid ${
                      scoreCasa === jogo.resultCasa
                        ? "rgba(177,235,11,0.55)"
                        : "rgba(255,255,255,0.14)"
                    }`,
                    boxShadow:
                      scoreCasa === jogo.resultCasa
                        ? "0 0 14px rgba(177,235,11,0.15)"
                        : "none",
                  }}
                >
                  {scoreCasa}
                </span>
                <span
                  className="text-xl font-black"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                  aria-hidden
                >
                  ×
                </span>
                <span
                  className="min-w-12 min-h-12 h-12 px-2 rounded-xl flex items-center justify-center text-2xl sm:text-[1.65rem] font-black tabular-nums"
                  style={{
                    background:
                      scoreVisitante === jogo.resultVisitante
                        ? "rgba(177,235,11,0.22)"
                        : "rgba(255,255,255,0.08)",
                    color:
                      scoreVisitante === jogo.resultVisitante
                        ? "#D4F862"
                        : "rgba(255,255,255,0.92)",
                    border: `2px solid ${
                      scoreVisitante === jogo.resultVisitante
                        ? "rgba(177,235,11,0.55)"
                        : "rgba(255,255,255,0.14)"
                    }`,
                    boxShadow:
                      scoreVisitante === jogo.resultVisitante
                        ? "0 0 14px rgba(177,235,11,0.15)"
                        : "none",
                  }}
                >
                  {scoreVisitante}
                </span>
              </div>
              <p
                className="text-xs sm:text-sm text-center leading-snug max-w-sm px-1"
                style={{ color: "rgba(255,255,255,0.62)" }}
              >
                Quando um número fica em verde claro, você acertou quantos gols
                aquele time fez.
              </p>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mx-4 sm:mx-5 h-px bg-white/10 mb-3" />

      <div className="px-4 sm:px-5 pb-4">
        {readOnly ? (
          <div
            className="w-full py-4 px-3 sm:px-4 rounded-xl flex flex-col items-center justify-center gap-2"
            style={{
              background: readOnlyPending
                ? "rgba(232,200,64,0.08)"
                : readOnlyPlacarPendente
                  ? "rgba(232,200,64,0.06)"
                  : resultadoResumo?.tone === "win"
                    ? review?.exact
                      ? "rgba(177,235,11,0.12)"
                      : "rgba(177,235,11,0.09)"
                    : resultadoResumo?.tone === "partial"
                      ? "rgba(177,235,11,0.06)"
                      : resultadoResumo?.tone === "miss"
                        ? "rgba(255,255,255,0.03)"
                        : review && review.points > 0
                          ? "rgba(177,235,11,0.10)"
                          : "rgba(255,255,255,0.03)",
              border: readOnlyPending
                ? "1px solid rgba(232,200,64,0.28)"
                : readOnlyPlacarPendente
                  ? "1px solid rgba(232,200,64,0.22)"
                  : resultadoResumo?.tone === "win"
                    ? review?.exact
                      ? "1px solid rgba(177,235,11,0.35)"
                      : "1px solid rgba(177,235,11,0.26)"
                    : resultadoResumo?.tone === "partial"
                      ? "1px solid rgba(177,235,11,0.20)"
                      : resultadoResumo?.tone === "miss"
                        ? "1px solid rgba(255,255,255,0.07)"
                        : review && review.points > 0
                          ? "1px solid rgba(177,235,11,0.28)"
                          : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {readOnlyPending ? (
              <span
                className="text-center leading-relaxed font-semibold text-base px-1"
                style={{ color: "rgba(252,234,160,0.98)" }}
              >
                Aguardando o início da partida.
              </span>
            ) : readOnlyPlacarPendente ? (
              <span
                className="text-center leading-relaxed font-semibold text-base px-1"
                style={{ color: "rgba(252,234,160,0.95)" }}
              >
                Estamos sincronizando o placar oficial. Volte daqui a pouco.
              </span>
            ) : readOnlyMatchLive ? (
              <span
                className="text-center leading-relaxed font-semibold text-base px-1"
                style={{ color: "rgba(255,255,255,0.88)" }}
              >
                Jogo em andamento. A pontuação do seu palpite aparece depois que
                o resultado oficial estiver disponível.
              </span>
            ) : !hasInitialPrediction &&
              (jogo.status === "encerrado" || temPlacarOficial) ? (
              <span
                className="text-center leading-relaxed font-semibold text-base px-1"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                Você não fez palpite nesta partida.
              </span>
            ) : resultadoResumo ? (
              <div
                className="flex flex-col items-center gap-2 w-full"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-center gap-2.5 flex-wrap px-1">
                  {resultadoResumo.tone === "win" && review?.exact ? (
                    <Sparkles
                      className="w-6 h-6 shrink-0"
                      style={{ color: "#D4F862" }}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  ) : null}
                  {resultadoResumo.tone === "win" && review && !review.exact ? (
                    <Target
                      className="w-6 h-6 shrink-0"
                      style={{ color: "#D4F862" }}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  ) : null}
                  {resultadoResumo.tone === "partial" ? (
                    <Star
                      className="w-6 h-6 shrink-0"
                      style={{ color: "#D4F862" }}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  ) : null}
                  {resultadoResumo.tone === "miss" ? (
                    <Disc
                      className="w-6 h-6 shrink-0"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`text-center leading-snug text-pretty ${resultadoResumo.tone !== "miss" ? "font-bold text-[17px] sm:text-lg" : "font-semibold text-base"}`}
                    style={{
                      color:
                        resultadoResumo.tone === "miss"
                          ? "rgba(255,255,255,0.88)"
                          : "#D4F862",
                    }}
                  >
                    {resultadoResumo.title}
                  </span>
                </div>
                {resultadoResumo.subtitle ? (
                  <span
                    className="text-center leading-relaxed text-sm sm:text-[15px] px-2 font-medium max-w-md"
                    style={{ color: "rgba(255,255,255,0.78)" }}
                  >
                    {resultadoResumo.subtitle}
                  </span>
                ) : null}
              </div>
            ) : review && review.points > 0 ? (
              <span
                className="text-center leading-relaxed font-bold text-lg px-1"
                style={{ color: "#D4F862" }}
              >
                Você ganhou {review.points} pontos nesta partida.
              </span>
            ) : (
              <span
                className="text-center leading-relaxed font-semibold text-base px-1"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                Sem pontuação nesta partida.
              </span>
            )}
          </div>
        ) : palpiteSalvo ? (
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div
              className="flex-1 min-h-[48px] py-3 rounded-xl flex items-center justify-center gap-2"
              style={{
                background: "rgba(177,235,11,0.12)",
                border: "1px solid rgba(177,235,11,0.30)",
              }}
            >
              <CircleCheck
                className="w-5 h-5 shrink-0"
                style={{ color: "#D4F862" }}
                strokeWidth={2.5}
                aria-hidden
              />
              <span
                className="font-bold text-base"
                style={{ color: "#D4F862" }}
              >
                Palpite salvo
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setPalpiteSalvo(false);
                }}
                disabled={isSubmitting}
                className="min-h-[48px] px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <Pencil
                  className="w-4 h-4 text-white/70"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-base font-semibold text-white/80">
                  Editar palpite
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              if (!canEdit || !ticketId || !onSavePrediction) return;
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
                setSaveError(
                  error instanceof Error
                    ? error.message
                    : "Erro ao salvar palpite",
                );
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={!canEdit || !ticketId || isSubmitting}
            className="w-full min-h-[52px] py-3.5 rounded-xl font-bold text-base transition-all duration-200"
            style={{
              background:
                !canEdit || !ticketId || isSubmitting
                  ? "#1A1A1A"
                  : hasInitialPrediction
                    ? "#B1EB0B"
                    : "#E6E6E6",
              color:
                !canEdit || !ticketId || isSubmitting
                  ? "rgba(255,255,255,0.22)"
                  : "#0E141B",
              boxShadow:
                !canEdit || !ticketId || isSubmitting || !hasInitialPrediction
                  ? "none"
                  : "0 0 16px rgba(177,235,11,0.22)",
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {isSubmitting
                ? "Salvando palpite..."
                : !canEdit && jogo.status !== "aberto"
                  ? "Palpites encerrados"
                  : !canEdit && isLockedByTime
                    ? hasInitialPrediction
                      ? lockUi.fechadoJaPassou
                      : "Fora do prazo — sem palpite nao entra nesta partida"
                    : hasInitialPrediction
                      ? "Atualizar palpite"
                      : "Fazer Palpite"}
            </span>
          </button>
        )}
        {!readOnly &&
        !palpiteSalvo &&
        !canEdit &&
        jogo.status === "aberto" &&
        isLockedByTime &&
        !hasInitialPrediction ? (
          <p
            className="mt-3 text-sm text-center leading-relaxed px-1"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            {lockUi.faixaForaPrazo}
          </p>
        ) : null}
        {saveError ? (
          <p className="mt-3 text-sm text-center leading-relaxed text-red-300 px-1">
            {saveError}
          </p>
        ) : null}
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
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(177,235,11,0.16)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[14px]">
            Classificação — Grupo {grupo}
          </span>
          <div className="flex gap-4">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span
                key={col}
                className="text-[11px] font-bold text-white/30 w-5 text-center"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        {/* Linhas */}
        {times.map((t, i) => (
          <div
            key={t.time.time_id}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: i < 2 ? "rgba(177,235,11,0.04)" : "transparent",
              borderBottom:
                i < times.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  background:
                    i === 0
                      ? "rgba(177,235,11,0.14)"
                      : "rgba(255,255,255,0.06)",
                  color: i === 0 ? "#B1EB0B" : "rgba(255,255,255,0.4)",
                }}
              >
                {t.posicao}
              </span>
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.time.escudo}
                  alt={t.time.sigla}
                  className="w-5 h-5 object-contain"
                />
              </div>
              <span className="text-white font-bold text-[13px] tracking-wide">
                {t.time.sigla}
              </span>
            </div>
            <div className="flex gap-4">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map(
                (val, vi) => (
                  <span
                    key={vi}
                    className="w-5 text-center text-[13px] font-bold"
                    style={{
                      color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {val}
                  </span>
                ),
              )}
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
            {Array.from(
              { length: Math.ceil(todosGrupos.length / 2) },
              (_, ri) => todosGrupos.slice(ri * 2, ri * 2 + 2),
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
                        background: ativo ? "rgba(177,235,11,0.08)" : "#0B0D0C",
                        border: ativo
                          ? "1px solid rgba(177,235,11,0.25)"
                          : "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                        style={{
                          background: ativo
                            ? "rgba(177,235,11,0.2)"
                            : "rgba(255,255,255,0.07)",
                          color: ativo ? "#B1EB0B" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {letra}
                      </span>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                        style={{ background: "rgba(255,255,255,0.9)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lider.time.escudo}
                          alt={lider.time.sigla}
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                      <span
                        className="font-bold text-[12px] flex-1 truncate"
                        style={{ color: ativo ? "#E8FF8A" : "#fff" }}
                      >
                        {lider.time.sigla}
                      </span>
                      <span
                        className="text-[11px] font-light"
                        style={{
                          color: ativo ? "#B1EB0B" : "rgba(255,255,255,0.35)",
                        }}
                      >
                        Lidera
                      </span>
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
  bolaoType: "principal" | "diario" | "extra";
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
  bolaoType: "principal" | "diario" | "extra";
  extraChampionshipId?: number | null;
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
  return (
    <span
      className="text-[11px] font-bold"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      #{pos}
    </span>
  );
}

function RankingAvatar({
  iniciais,
  isMe,
  size = 32,
}: {
  iniciais: string;
  isMe?: boolean;
  size?: number;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: isMe ? "rgba(218,182,130,0.15)" : "rgba(255,255,255,0.07)",
        color: isMe ? "#D7FF59" : "rgba(255,255,255,0.5)",
        border: isMe
          ? "1px solid rgba(218,182,130,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {iniciais}
    </div>
  );
}

function RankingView({
  rows,
  stats,
  bolaoType,
}: {
  rows: RankingRowView[];
  stats: ResumoStats;
  bolaoType: PredictionBolaoType;
}) {
  const lockCopy = palpiteLockUiCopy(bolaoType);
  const MEU = rows.find((r) => r.isMe) ??
    rows[0] ?? {
      pos: 0,
      nome: "Você",
      iniciais: "VO",
      acertos: 0,
      pts: 0,
      exact: 0,
      gols: 0,
    };
  return (
    <div className="flex flex-col gap-3">
      {/* Minha posição */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background: "linear-gradient(135deg, #F6D13B2E 0%, #F1E8631F 100%)",
          border: "1px solid rgba(80,120,40,0.25)",
        }}
      >
        <p className="text-[12px] text-[#FFFFFF8C] font-bold tracking-widest uppercase mb-3">
          Sua posição atual
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <RankingAvatar iniciais={MEU.iniciais} isMe size={44} />
              <div
                className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#B1EB0B" }}
              >
                <Coins
                  className="w-2.5 h-2.5"
                  style={{ color: "#0E141B" }}
                  strokeWidth={2.5}
                />
              </div>
            </div>
            <div>
              <p className="text-white font-black text-[18px] leading-tight">
                #{MEU.pos} no Ranking
              </p>
              <p className="text-[12px] mt-0.5 text-[#E8FF8A]">
                {MEU.acertos} acertos · {MEU.pts} pontos
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className="font-black text-[34px] leading-none"
              style={{ color: "#E8FF8A" }}
            >
              {MEU.pts}
            </p>
            <p className="text-[12px] mt-0.5 text-[#FFFFFF59]">pontos</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            Icon: Target,
            val: stats.palpites,
            label: "Palpites",
            color: "#B1EB0B",
          },
          {
            Icon: CircleCheck,
            val: stats.acertos,
            label: "Acertos",
            color: "#B1EB0B",
          },
          { Icon: Star, val: stats.pontos, label: "Pontos", color: "#D7FF59" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-2xl py-4 flex flex-col items-center gap-1"
            style={{
              background: "#0B0D0C",
              border: "1px solid rgba(177,235,11,0.12)",
            }}
          >
            <Icon className="w-5 h-5 mb-1" style={{ color }} strokeWidth={2} />
            <span className="text-white font-black text-[22px] leading-none">
              {val}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(177,235,11,0.14)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[14px]">
            Top Palpiteiros
          </span>
          <button
            className="text-[13px] font-semibold"
            style={{ color: "#B1EB0B" }}
          >
            Ver todos
          </button>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: r.isMe ? "rgba(177,235,11,0.06)" : "transparent",
              borderBottom:
                i < rows.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
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
                  <span
                    className="text-[11px] font-normal ml-1"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    (você)
                  </span>
                )}
              </p>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {r.acertos} acertos
              </p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span
                className="font-black text-[16px]"
                style={{ color: r.isMe ? "#B1EB0B" : "#fff" }}
              >
                {r.pts}
              </span>
              <span
                className="text-[12px]"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                pts
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{
          background: "rgba(218,182,130,0.06)",
          border: "1px solid rgba(218,182,130,0.18)",
        }}
      >
        <Bell
          className="w-5 h-5 shrink-0 mt-0.5"
          style={{ color: "#D7FF59" }}
          strokeWidth={2}
        />
        <div>
          <p className="font-bold text-[13px]" style={{ color: "#D7FF59" }}>
            Prazo para palpitar
          </p>
          <p
            className="text-[12px] mt-1 leading-relaxed"
            style={{ color: "rgba(218,182,130,0.5)" }}
          >
            {lockCopy.rankingBloco}
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
          boxShadow: "inset 0 0 0 1px rgba(177,235,11,0.28)",
        }}
      />
      <div
        className="absolute right-0 top-1/2 z-1 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "var(--background)",
          boxShadow: "inset 0 0 0 1px rgba(177,235,11,0.28)",
        }}
      />
      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 border-t border-dashed border-white/14" />
    </div>
  );
}

function TicketBarcodeMini() {
  const w = [2, 3, 2, 4, 2, 3, 2, 2, 4, 3, 2, 3, 2, 2, 4, 2, 3];
  return (
    <div
      className="flex items-end justify-center gap-[2px] h-6 opacity-45 mt-3"
      aria-hidden
    >
      {w.map((width, i) => (
        <span
          key={i}
          className="rounded-[1px] bg-white/80"
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
          style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px dashed rgba(177,235,11,0.2)",
          }}
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
  bolaoType: "principal" | "diario" | "extra";
  stats: ResumoStats;
  rankingPos: number | null;
  historico: HistoricoRowView[];
  loadingHistorico: boolean;
  jogosById: Record<number, Jogo>;
}) {
  const [resumoSecao, setResumoSecao] = useState<"geral" | "historico">(
    "geral",
  );

  return (
    <div
      className="relative rounded-[14px]"
      style={{
        border: "1px solid rgba(177,235,11,0.45)",
        boxShadow:
          "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        background:
          "linear-gradient(165deg, #101710 0%, #0B0D0C 42%, #050605 100%)",
      }}
    >
      <div className="relative z-1 pl-[18px] pr-4 pt-4 pb-3 sm:pr-5 flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/80 font-mono leading-snug">
          {resultMode ? "Resumo do ticket (resultado)" : "Resumo do ticket"}
        </p>
        <span
          className="text-[8px] font-bold uppercase tracking-[0.28em] text-white/25 shrink-0 pt-0.5"
          aria-hidden
        >
          Ingresso
        </span>
      </div>

      <div className="relative z-1 px-4 pb-3 sm:px-5 sm:pb-3 -mt-0.5">
        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {ticketId && (
            <div
              className="rounded-md px-2.5 py-2 text-[12px]"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px dashed rgba(177,235,11,0.22)",
              }}
            >
              Ticket
              <p
                className="text-white font-semibold mt-0.5 truncate font-mono"
                title={ticketId}
              >
                {ticketId}
              </p>
            </div>
          )}
          {rankingPos != null && (
            <div
              className="rounded-md px-2.5 py-2 text-[12px]"
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px dashed rgba(177,235,11,0.22)",
              }}
            >
              Ranking
              <p className="text-white font-semibold mt-0.5 font-mono">
                #{rankingPos}
              </p>
            </div>
          )}
          <div
            className="rounded-md px-2.5 py-2 text-[12px]"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px dashed rgba(34,197,94,0.28)",
            }}
          >
            Pontos
            <p className="text-[#4ADE80] font-semibold mt-0.5 font-mono">
              {stats.pontos} pts
            </p>
          </div>
          <div
            className="rounded-md px-2.5 py-2 text-[12px]"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed rgba(177,235,11,0.22)",
            }}
          >
            Acertos
            <p className="text-white font-semibold mt-0.5 font-mono">
              {stats.acertos}
            </p>
          </div>
          <div
            className="rounded-md px-2.5 py-2 text-[12px]"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed rgba(177,235,11,0.22)",
            }}
          >
            Placar exato
            <p className="text-white font-semibold mt-0.5 font-mono">
              {stats.exatos}
            </p>
          </div>
          <div
            className="rounded-md px-2.5 py-2 text-[12px]"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px dashed rgba(177,235,11,0.22)",
            }}
          >
            Palpites
            <p className="text-white font-semibold mt-0.5 font-mono">
              {stats.palpites}
            </p>
          </div>
        </div>
      </div>

      <TicketPerforationLine />

      <div
        className="relative z-1 flex w-full overflow-hidden border-t border-white/6"
        style={{ background: "rgba(0,0,0,0.2)" }}
      >
        <button
          type="button"
          onClick={() => setResumoSecao("geral")}
          className="flex-1 py-3.5 px-2 text-[11px] font-bold font-mono uppercase tracking-wide transition-colors border-r border-dashed border-white/15"
          style={{
            background:
              resumoSecao === "geral" ? "rgba(177,235,11,0.1)" : "transparent",
            color:
              resumoSecao === "geral" ? "#E8FF8A" : "rgba(255,255,255,0.4)",
          }}
        >
          Resumo
        </button>
        <button
          type="button"
          onClick={() => setResumoSecao("historico")}
          className="flex-1 py-3.5 px-2 text-[11px] font-bold font-mono uppercase tracking-wide transition-colors"
          style={{
            background:
              resumoSecao === "historico"
                ? "rgba(177,235,11,0.1)"
                : "transparent",
            color:
              resumoSecao === "historico" ? "#E8FF8A" : "rgba(255,255,255,0.4)",
          }}
        >
          Histórico
        </button>
      </div>

      <TicketPerforationLine />

      <div
        className="relative z-1 px-4 pb-4 pt-3 sm:px-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.35) 100%)",
        }}
      >
        {resumoSecao === "geral" ? (
          <div
            className="text-[12px] leading-relaxed rounded-lg px-3 py-3"
            style={{
              border: "1px dashed rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <p className="text-[12px] uppercase tracking-[0.14em] font-bold text-white/40 mb-2 font-mono">
              Informações
            </p>
            <ul className="space-y-2.5 text-white/75">
              <li className="flex justify-between gap-3">
                <span className="text-white/80 shrink-0">Bolão</span>
                <span className="text-right font-medium text-white/90">
                  {bolaoType === "principal"
                    ? "Copa do Mundo 2026 — jogos do dia (Copa inteira)"
                    : "Copa do Mundo 2026 — jogos do dia"}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-white/80 shrink-0">Regra</span>
                <span className="text-right font-medium text-white/90">
                  {bolaoType === "principal"
                    ? "Ticket válido durante toda a Copa: todo dia você palpita em todos os jogos do dia."
                    : "Ticket diário: você palpita apenas nos jogos daquele dia."}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-white/80 shrink-0">Status do ticket</span>
                <span className="text-right font-medium text-white/90 font-mono">
                  {resultMode ? "Resultado disponível" : "Em andamento"}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingHistorico ? (
              <HistoricoSkeletonRows />
            ) : historico.length === 0 ? (
              <div
                className="rounded-lg px-4 py-4 text-[12px] text-white/80 font-mono"
                style={{
                  border: "1px dashed rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.15)",
                }}
              >
                Nenhum palpite registrado ainda.
              </div>
            ) : (
              historico.map((item) =>
                (() => {
                  const jogo = jogosById[item.matchId];
                  return (
                    <div
                      key={`${item.matchId}-${item.submittedAt}`}
                      className="rounded-lg px-3.5 py-3.5"
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        border: "1px dashed rgba(177,235,11,0.2)",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {jogo?.escudoCasa ? (
                              <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={jogo.escudoCasa}
                                  alt={item.mandante}
                                  className="w-5 h-5 object-contain"
                                />
                              </div>
                            ) : null}
                            <p className="text-[13px] font-bold text-white leading-snug">
                              {item.mandante}{" "}
                              <span className="text-white/80 font-normal">
                                vs
                              </span>{" "}
                              {item.visitante}
                            </p>
                            {jogo?.escudoVisitante ? (
                              <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={jogo.escudoVisitante}
                                  alt={item.visitante}
                                  className="w-5 h-5 object-contain"
                                />
                              </div>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5">
                            {item.jogoData} · {item.jogoHora}
                          </p>
                        </div>
                        <span
                          className="text-[12px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            background:
                              item.resultadoCasa != null &&
                              item.resultadoVisitante != null
                                ? "rgba(148,163,184,0.12)"
                                : "rgba(34,197,94,0.12)",
                            color:
                              item.resultadoCasa != null &&
                              item.resultadoVisitante != null
                                ? "rgba(226,232,240,0.85)"
                                : "#86EFAC",
                            border: `1px solid ${item.resultadoCasa != null && item.resultadoVisitante != null ? "rgba(148,163,184,0.25)" : "rgba(34,197,94,0.28)"}`,
                          }}
                        >
                          {item.resultadoCasa != null &&
                          item.resultadoVisitante != null
                            ? "Encerrado"
                            : "Aberto"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div
                          className="rounded-lg px-2.5 py-2"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <p className="text-white/40 font-bold uppercase tracking-wide">
                            Palpite enviado em
                          </p>
                          <p className="text-white/90 font-semibold mt-0.5">
                            {new Date(item.submittedAt).toLocaleDateString(
                              "pt-BR",
                            )}{" "}
                            às{" "}
                            {new Date(item.submittedAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                        <div
                          className="rounded-lg px-2.5 py-2"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <p className="text-white/40 font-bold uppercase tracking-wide">
                            Jogo
                          </p>
                          <p className="text-white/90 font-semibold mt-0.5">
                            {item.jogoData}, {item.jogoHora}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                        <div>
                          <span className="text-white/40">Seu palpite</span>
                          <p className="font-black text-white mt-0.5">
                            {item.palpiteCasa}{" "}
                            <span className="text-white/30 font-normal">x</span>{" "}
                            {item.palpiteVisitante}
                          </p>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                        <div>
                          <span className="text-white/40">Resultado</span>
                          <p className="font-black text-white mt-0.5">
                            {item.resultadoCasa ?? "-"}{" "}
                            <span className="text-white/30 font-normal">x</span>{" "}
                            {item.resultadoVisitante ?? "-"}
                          </p>
                        </div>
                        <div className="sm:ml-auto flex items-center gap-2">
                          <span
                            className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                item.pontos > 0
                                  ? "rgba(34,197,94,0.1)"
                                  : "rgba(255,255,255,0.06)",
                              color:
                                item.pontos > 0
                                  ? "#86EFAC"
                                  : "rgba(255,255,255,0.45)",
                              border: `1px solid ${item.pontos > 0 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.1)"}`,
                            }}
                          >
                            {item.exact
                              ? "Placar exato"
                              : item.pontos > 0
                                ? "Acerto parcial"
                                : "Sem pontos"}
                          </span>
                          <span
                            className={`text-[13px] font-black ${item.pontos > 0 ? "text-[#4ADE80]" : "text-white/40"}`}
                          >
                            {item.pontos > 0 ? `+${item.pontos} pts` : "0 pts"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })(),
              )
            )}
          </div>
        )}
        <TicketBarcodeMini />
      </div>
    </div>
  );
}

// ── Sidebar desktop ───────────────────────────────────────────
function DesktopSidebar({
  grupo,
  tabela,
  grupos,
  onGrupo,
  rankingRows,
  stats,
  bolaoType,
}: {
  grupo: string;
  tabela: TabelaGrupos | null;
  grupos: string[];
  onGrupo: (g: string) => void;
  rankingRows: RankingRowView[];
  stats: ResumoStats;
  bolaoType: PredictionBolaoType;
}) {
  const lockCopy = palpiteLockUiCopy(bolaoType);
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
          {
            Icon: Target,
            val: stats.palpites,
            label: "Palpites",
            color: "#B1EB0B",
          },
          {
            Icon: CircleCheck,
            val: stats.acertos,
            label: "Acertos",
            color: "#B1EB0B",
          },
          { Icon: Star, val: stats.pontos, label: "Pontos", color: "#D7FF59" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-xl py-3 flex flex-col items-center gap-0.5"
            style={{
              background: "#0B0D0C",
              border: "1px solid rgba(177,235,11,0.12)",
            }}
          >
            <Icon
              className="w-4 h-4 mb-0.5"
              style={{ color }}
              strokeWidth={2}
            />
            <span className="text-white font-black text-[20px] leading-none">
              {val}
            </span>
            <span
              className="text-[12px]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Classificação */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(177,235,11,0.16)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Seta prev */}
          <button
            onClick={() => prev && onGrupo(prev)}
            disabled={!prev}
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-opacity"
            style={{
              background: "rgba(255,255,255,0.06)",
              opacity: prev ? 1 : 0.25,
            }}
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
            style={{
              background: "rgba(255,255,255,0.06)",
              opacity: next ? 1 : 0.25,
            }}
          >
            <ChevronDown className="w-3 h-3 text-white/60 -rotate-90" />
          </button>

          {/* Colunas */}
          <div className="flex gap-2 shrink-0">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span
                key={col}
                className="text-[9px] font-bold text-white/30 w-5 text-center"
              >
                {col}
              </span>
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
              background: i < 2 ? "rgba(177,235,11,0.04)" : "transparent",
              borderBottom:
                i < times.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
            }}
          >
            {/* Posição */}
            <span
              className="w-5 h-5 rounded-[5px] flex items-center justify-center text-[12px] font-bold shrink-0"
              style={{
                background:
                  i === 0 ? "rgba(177,235,11,0.14)" : "rgba(255,255,255,0.06)",
                color: i === 0 ? "#B1EB0B" : "rgba(255,255,255,0.4)",
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
              <img
                src={t.time.escudo}
                alt={t.time.sigla}
                className="w-5 h-5 object-contain"
              />
            </div>
            {/* Sigla */}
            <span className="text-white font-bold text-[12px] flex-1 min-w-0 truncate">
              {t.time.sigla}
            </span>
            {/* Stats */}
            <div className="flex gap-2 shrink-0">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map(
                (val, vi) => (
                  <span
                    key={vi}
                    className="w-5 text-center text-[12px] font-bold"
                    style={{
                      color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {val}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(177,235,11,0.14)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[13px]">
            Top Palpiteiros
          </span>
          <button
            className="text-[12px] font-semibold"
            style={{ color: "#B1EB0B" }}
          >
            Ver todos
          </button>
        </div>
        {rankingRows.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{
              background: r.isMe ? "rgba(177,235,11,0.07)" : "transparent",
              borderBottom:
                i < rankingRows.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
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
                  <span
                    className="text-[12px] font-normal ml-0.5"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    (você)
                  </span>
                )}
              </p>
              <p
                className="text-[12px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {r.acertos} acertos
              </p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span
                className="font-black text-[14px]"
                style={{ color: r.isMe ? "#B1EB0B" : "#fff" }}
              >
                {r.pts}
              </span>
              <span
                className="text-[9px]"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                pts
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{
          background: "rgba(218,182,130,0.06)",
          border: "1px solid rgba(218,182,130,0.18)",
        }}
      >
        <Bell
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: "#D7FF59" }}
          strokeWidth={2}
        />
        <div>
          <p className="font-bold text-[12px]" style={{ color: "#D7FF59" }}>
            Prazo para palpitar
          </p>
          <p
            className="text-[11px] mt-1 leading-relaxed"
            style={{ color: "rgba(218,182,130,0.5)" }}
          >
            {lockCopy.rankingBloco}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers de data para o RoundPhaseNav ─────────────────────
const DIAS_SEMANA_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
function parseDatePill(dataBR: string) {
  const parts = dataBR.split("/");
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = Number(parts[2]);
  if (!d || !m || !y) return null;
  const dateObj = new Date(y, m - 1, d);
  return {
    diaSemana: DIAS_SEMANA_PT[dateObj.getDay()] ?? "--",
    dia: String(d).padStart(2, "0"),
    mes: MESES[m - 1] ?? "---",
  };
}

// ── Round / Phase Navigation ──────────────────────────────────
function RoundPhaseNav({
  jogos,
  predictionsMap,
  selectedRodada,
  onRodada,
  selectedDate,
  onDate,
  grupo,
  grupos,
  onGrupo,
}: {
  jogos: Jogo[];
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>;
  selectedRodada: number;
  onRodada: (r: number) => void;
  selectedDate: string | null;
  onDate: (d: string | null) => void;
  grupo: string;
  grupos: string[];
  onGrupo: (g: string) => void;
}) {
  const rodadas = useMemo(
    () => Array.from(new Set(jogos.map((j) => j.rodada))).sort((a, b) => a - b),
    [jogos],
  );
  const rodadaIdx = rodadas.indexOf(selectedRodada);
  const canPrev = rodadaIdx > 0;
  const canNext = rodadaIdx < rodadas.length - 1;

  const jogosNaRodada = useMemo(
    () => jogos.filter((j) => j.rodada === selectedRodada),
    [jogos, selectedRodada],
  );

  const datas = useMemo(
    () =>
      Array.from(new Set(jogosNaRodada.map((j) => j.dataBR)))
        .filter(Boolean)
        .sort((a, b) => (brDateToUtcMs(a) ?? 0) - (brDateToUtcMs(b) ?? 0)),
    [jogosNaRodada],
  );

  // Progress always reflects the full round so users see overall completion
  const totalJogos = jogosNaRodada.length;
  const jogosPalpitados = jogosNaRodada.filter((j) =>
    Boolean(predictionsMap[j.id]),
  ).length;
  const pct =
    totalJogos > 0 ? Math.round((jogosPalpitados / totalJogos) * 100) : 0;

  function dateStatus(d: string): "done" | "partial" | "pending" {
    const jd = jogosNaRodada.filter((j) => j.dataBR === d);
    const p = jd.filter((j) => Boolean(predictionsMap[j.id])).length;
    if (p === 0) return "pending";
    if (p === jd.length) return "done";
    return "partial";
  }

  return (
    <div className="mb-5 flex flex-col gap-2.5">
      {/* ── 1. Navegação de fase / rodada ── */}
      <div
        className="flex items-center justify-between rounded-[14px] px-4 py-3"
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => canPrev && onRodada(rodadas[rodadaIdx - 1]!)}
          disabled={!canPrev}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity"
          style={{
            background: "rgba(255,255,255,0.06)",
            opacity: canPrev ? 1 : 0.25,
          }}
        >
          <ChevronLeft className="h-4 w-4 text-white/70" strokeWidth={2.5} />
        </button>
        <span className="text-[15px] font-black text-white">
          Fase de Grupos — {rodadaIdx + 1}
        </span>
        <button
          type="button"
          onClick={() => canNext && onRodada(rodadas[rodadaIdx + 1]!)}
          disabled={!canNext}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity"
          style={{
            background: "rgba(255,255,255,0.06)",
            opacity: canNext ? 1 : 0.25,
          }}
        >
          <ChevronRight className="h-4 w-4 text-white/70" strokeWidth={2.5} />
        </button>
      </div>

      {/* ── 2. Date strip ── */}
      {datas.length > 0 && (
        <div
          className="overflow-hidden rounded-[14px]"
          style={{
            background: "#0B0D0C",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide">
            {datas.map((d) => {
              const fmt = parseDatePill(d);
              if (!fmt) return null;
              const status = dateStatus(d);
              const isSelected = selectedDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDate(isSelected ? null : d)}
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-[10px] px-3 py-2.5 transition-all active:scale-95"
                  style={
                    isSelected
                      ? {
                          background: "rgba(177,235,11,0.15)",
                          border: "1px solid rgba(177,235,11,0.50)",
                          minWidth: 64,
                          boxShadow: "0 0 12px rgba(177,235,11,0.18)",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          minWidth: 64,
                        }
                  }
                >
                  {/* status dot / check */}
                  <span className="mb-1 flex h-4 items-center justify-center">
                    {status === "done" ? (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full"
                        style={{ background: "rgba(177,235,11,0.25)" }}
                      >
                        <Check
                          className="h-2.5 w-2.5 text-primary"
                          strokeWidth={3}
                        />
                      </span>
                    ) : (
                      <span
                        className="h-[7px] w-[7px] rounded-full animate-pulse"
                        style={{ background: "#E6C220" }}
                      />
                    )}
                  </span>
                  <span
                    className="text-[9px] font-black uppercase tracking-wider"
                    style={{
                      color: isSelected ? "#B1EB0B" : "rgba(255,255,255,0.40)",
                    }}
                  >
                    {fmt.diaSemana}
                  </span>
                  <span
                    className="text-[14px] font-black leading-tight"
                    style={{
                      color: isSelected ? "#fff" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {fmt.dia}
                  </span>
                  <span
                    className="text-[9px] font-semibold uppercase"
                    style={{
                      color: isSelected ? "#B1EB0B" : "rgba(255,255,255,0.30)",
                    }}
                  >
                    {fmt.mes}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Progress bar ── */}
      <div
        className="rounded-[14px] px-4 py-3"
        style={{
          background: "#0B0D0C",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-[12px] font-semibold"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            <span className="font-black text-white">{jogosPalpitados}</span> /{" "}
            {totalJogos} palpites feitos
          </span>
          <span
            className="text-[12px] font-black"
            style={{
              color: pct === 100 ? "#B1EB0B" : "rgba(255,255,255,0.40)",
            }}
          >
            {pct}%
          </span>
        </div>
        <div
          className="h-[5px] overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background:
                pct === 100
                  ? "linear-gradient(90deg, #B1EB0B, #E8FF8A)"
                  : "linear-gradient(90deg, #B1EB0B, #D4F040)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
function PalpitesPageContent({
  initialData,
}: {
  initialData: PalpitesInitialData | null;
}) {
  const searchParams = useSearchParams();
  const resultMode = searchParams.get("mode") === "resultado";
  const ticketId = searchParams.get("ticket");
  const hasBoloesFlow = Boolean(ticketId);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;
  const [bolaoType, setBolaoType] = useState<"principal" | "diario" | "extra">(
    initialData?.bolaoType ?? "principal",
  );
  const [tab, setTab] = useState<TabView>("jogos");
  const [grupo, setGrupo] = useState(initialData?.grupo ?? "");
  const [jogos, setJogos] = useState<Jogo[]>(initialData?.jogos ?? []);
  const [grupos, setGrupos] = useState<string[]>(initialData?.grupos ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [erro, setErro] = useState(initialData?.erro ?? false);
  const [tabela, setTabela] = useState<TabelaGrupos | null>(
    initialData?.tabela ?? null,
  );
  const [loadingTabela, setLoadingTabela] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTabView>("jogos");
  const [rankingRows, setRankingRows] = useState<RankingRowView[]>(
    initialData?.rankingRows ?? [],
  );
  const [resumoStats, setResumoStats] = useState<ResumoStats>(
    initialData?.resumoStats ?? {
      palpites: 0,
      acertos: 0,
      pontos: 0,
      exatos: 0,
    },
  );
  const [historicoRows, setHistoricoRows] = useState<HistoricoRowView[]>(
    initialData?.historicoRows ?? [],
  );
  const [predictionsMap, setPredictionsMap] = useState<
    Record<number, { scoreCasa: number; scoreVisitante: number }>
  >(initialData?.predictionsMap ?? {});
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [selectedRodada, setSelectedRodada] = useState<number | null>(() => {
    if (!initialData?.jogos?.length) return null;
    const bt = initialData.bolaoType;
    const lockIds =
      bt === "diario" || bt === "extra"
        ? Object.keys(initialData.predictionsMap ?? {})
            .map(Number)
            .filter(Number.isFinite)
        : [];
    const extraId =
      bt === "extra" && initialData.extraChampionshipId != null
        ? initialData.extraChampionshipId
        : null;
    const map =
      extraId != null
        ? matchDateMapFromJogosWithCompetition(initialData.jogos, extraId)
        : matchDateMapFromJogos(initialData.jogos);
    const todayStr = resolveDiarioPlayableDate(map, {
      lockToMatchIds: lockIds,
      ...(extraId != null ? { competitionId: extraId } : {}),
    });
    const rodadas = Array.from(
      new Set(initialData.jogos.map((j: Jogo) => j.rodada)),
    ).sort((a: number, b: number) => a - b);
    return (
      rodadas.find((r: number) =>
        initialData.jogos.some(
          (j: Jogo) => j.rodada === r && j.dataBR === todayStr,
        ),
      ) ??
      rodadas[0] ??
      null
    );
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const showPredictionsSkeleton =
    Boolean(ticketId) &&
    loadingPredictions &&
    Object.keys(predictionsMap).length === 0;

  const bolaoTypeRef = useRef(bolaoType);
  bolaoTypeRef.current = bolaoType;
  const predictionsMapRef = useRef(predictionsMap);
  predictionsMapRef.current = predictionsMap;

  useEffect(() => {
    if (initialData && initialData.jogos.length > 0) {
      return;
    }
    setLoadingTabela(true);
    fetch("/api/tabela")
      .then((r) => r.json())
      .then((data) => {
        setTabela(pickTabelaGrupos(data));
      })
      .catch(() => {})
      .finally(() => setLoadingTabela(false));
  }, [initialData]);

  /** Partidas: sempre atualizar (SSR pode ficar velho; placar e ranking dependem disso). */
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function applyRodadaInicial(parsed: Jogo[]) {
      const bt = bolaoTypeRef.current;
      const lockIds =
        bt === "diario" || bt === "extra"
          ? Object.keys(predictionsMapRef.current)
              .map(Number)
              .filter(Number.isFinite)
          : [];
      const extraId =
        bt === "extra" && initialDataRef.current?.extraChampionshipId != null
          ? initialDataRef.current.extraChampionshipId
          : null;
      const map =
        bt === "extra" && extraId != null
          ? matchDateMapFromJogosWithCompetition(parsed, extraId)
          : matchDateMapFromJogos(parsed);
      const todayDateStr = resolveDiarioPlayableDate(map, {
        lockToMatchIds: lockIds,
        ...(bt === "extra" && extraId != null ? { competitionId: extraId } : {}),
      });
      const rodadasDispAll = Array.from(
        new Set(parsed.map((j) => j.rodada)),
      ).sort((a, b) => a - b);
      const rodadaContemHoje = rodadasDispAll.find((r) =>
        parsed
          .filter((j) => j.rodada === r)
          .some((j) => j.dataBR === todayDateStr),
      );
      setSelectedRodada((prev) =>
        prev != null ? prev : (rodadaContemHoje ?? rodadasDispAll[0] ?? 0),
      );
    }

    async function tick() {
      try {
        const id = initialDataRef.current?.extraChampionshipId;
        const comp =
          bolaoTypeRef.current === "extra" && id != null
            ? `?competitionId=${encodeURIComponent(String(id))}`
            : "";
        const r = await fetch(`/api/partidas${comp}`, { cache: "no-store" });
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok) {
          setErro(true);
          return;
        }
        const fases = data?.partidas as Record<string, any> | undefined;
        const { jogos: parsed, grupos: letras } = parseAllPartidas(fases);
        if (parsed.length === 0) {
          setJogos([]);
          setGrupos([]);
          setGrupo("GERAL");
          setErro(false);
          return;
        }
        setJogos(parsed);
        setGrupos(letras);
        setGrupo((prev) =>
          letras.includes(prev) ? prev : (letras[0] ?? "GERAL"),
        );
        setErro(false);
        applyRodadaInicial(parsed);
      } catch {
        if (!cancelled) setErro(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void tick();
    intervalId = setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (resultMode) setTab("jogos");
  }, [resultMode]);

  useEffect(() => {
    if (!initialData?.ticketId || initialData.ticketId !== ticketId) return;
    setBolaoType(initialData.bolaoType);
  }, [initialData?.ticketId, initialData?.bolaoType, ticketId]);

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
          { credentials: "include", cache: "no-store" },
        );
        const d = (await r.json()) as { bolaoType?: string };
        const b =
          d.bolaoType === "diario"
            ? "diario"
            : d.bolaoType === "extra"
              ? "extra"
              : "principal";
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
        const r = await fetch(
          `/api/palpites?ticketId=${encodeURIComponent(ticketId)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const d = (await r.json()) as {
          predictions?: Array<{
            matchId: number;
            scoreCasa: number;
            scoreVisitante: number;
          }>;
        };
        if (!r.ok || !Array.isArray(d.predictions)) return;
        const next: Record<
          number,
          { scoreCasa: number; scoreVisitante: number }
        > = {};
        for (const p of d.predictions) {
          next[p.matchId] = {
            scoreCasa: p.scoreCasa,
            scoreVisitante: p.scoreVisitante,
          };
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
    if ((bolaoType !== "diario" && bolaoType !== "extra") || jogos.length === 0) return;
    const lockIds = Object.keys(predictionsMap).map(Number).filter(Number.isFinite);
    const extraId =
      bolaoType === "extra" && initialData?.extraChampionshipId != null
        ? initialData.extraChampionshipId
        : null;
    const map =
      bolaoType === "extra" && extraId != null
        ? matchDateMapFromJogosWithCompetition(jogos, extraId)
        : matchDateMapFromJogos(jogos);
    const playable = resolveDiarioPlayableDate(map, {
      lockToMatchIds: lockIds,
      ...(bolaoType === "extra" && extraId != null ? { competitionId: extraId } : {}),
    });
    const rodadasDispAll = Array.from(new Set(jogos.map((j) => j.rodada))).sort((a, b) => a - b);
    const rodadaContem = rodadasDispAll.find((r) =>
      jogos.filter((j) => j.rodada === r).some((j) => j.dataBR === playable),
    );
    if (rodadaContem != null)
      setSelectedRodada((prev) => (prev === rodadaContem ? prev : rodadaContem));
  }, [bolaoType, jogos, predictionsMap, initialData?.extraChampionshipId]);

  const jogosPlacarSignature = useMemo(
    () =>
      jogos
        .map(
          (j) =>
            `${j.id}:${j.resultCasa ?? ""}:${j.resultVisitante ?? ""}:${j.status}`,
        )
        .sort()
        .join("|"),
    [jogos],
  );

  useEffect(() => {
    (async () => {
      try {
        const q = new URLSearchParams();
        if (ticketId) q.set("ticketId", ticketId);
        const r = await fetch(`/api/palpites/ranking?${q.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const d = (await r.json()) as {
          ranking?: Array<{
            pos: number;
            ticketId: string;
            totalPoints: number;
            outcomeCount: number;
            exactCount: number;
            goalsCount: number;
            isMe: boolean;
          }>;
        };
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
          })),
        );
      } catch {}
    })();
  }, [bolaoType, ticketId, jogosPlacarSignature]);

  useEffect(() => {
    if (!ticketId) return;
    (async () => {
      setLoadingResumo(true);
      try {
        const q = new URLSearchParams({ ticketId });
        const [resumoResp, historicoResp] = await Promise.all([
          fetch(`/api/palpites/resumo?${q.toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`/api/palpites/historico?${q.toString()}&limit=30`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        const resumoData = (await resumoResp.json().catch(() => ({}))) as {
          resumo?: ResumoStats;
        };
        const histData = (await historicoResp.json().catch(() => ({}))) as {
          historico?: HistoricoRowView[];
        };
        if (resumoResp.ok && resumoData.resumo)
          setResumoStats(resumoData.resumo);
        if (historicoResp.ok && Array.isArray(histData.historico))
          setHistoricoRows(histData.historico);
      } finally {
        setLoadingResumo(false);
      }
    })();
  }, [ticketId, jogosPlacarSignature]);

  const savePrediction = async (payload: {
    matchId: number;
    scoreCasa: number;
    scoreVisitante: number;
  }) => {
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
      [payload.matchId]: {
        scoreCasa: payload.scoreCasa,
        scoreVisitante: payload.scoreVisitante,
      },
    }));
    if (isNewPrediction) {
      setResumoStats((prev) => ({ ...prev, palpites: prev.palpites + 1 }));
    }
  };

  const today = todayBR();
  const dailyLike = bolaoType === "diario" || bolaoType === "extra";
  const extraPlayCompId =
    bolaoType === "extra" && initialData?.extraChampionshipId != null
      ? initialData.extraChampionshipId
      : null;

  const lockIdsForDailyLike = dailyLike
    ? Object.keys(predictionsMap).map(Number).filter(Number.isFinite)
    : [];

  const matchMapForPlayable =
    extraPlayCompId != null
      ? matchDateMapFromJogosWithCompetition(jogos, extraPlayCompId)
      : matchDateMapFromJogos(jogos);

  const diarioPlayableDate = resolveDiarioPlayableDate(matchMapForPlayable, {
    lockToMatchIds: lockIdsForDailyLike,
    ...(extraPlayCompId != null ? { competitionId: extraPlayCompId } : {}),
  });
  const todayMs = brDateToUtcMs(today);
  const jogosOnPlayableDate = jogos.filter((j) => {
    if (bolaoType === "principal") return true;
    if (!dailyLike) return true;
    const ms = brDateToUtcMs(j.dataBR);
    if (ms == null || todayMs == null) return true;
    return j.dataBR === diarioPlayableDate;
  });
  const nowMs = Date.now();
  const diarioLockedMode =
    dailyLike &&
    jogosOnPlayableDate.length > 0 &&
    jogosOnPlayableDate.every(
      (j) => j.status === "encerrado" || isLockedByKickoff(j.kickoffAt, nowMs, bolaoType),
    );
  const readOnlyMode = resultMode || diarioLockedMode;
  const showJogos = readOnlyMode ? resultTab === "jogos" : tab === "jogos";
  const showRanking = readOnlyMode
    ? resultTab === "ranking"
    : tab === "ranking";
  const showResumo = readOnlyMode ? resultTab === "resumo" : tab === "resumo";

  const jogosBase = jogosOnPlayableDate.filter((j) => {
    if (!dailyLike) return true;
    if (readOnlyMode) return true;
    return j.status !== "encerrado";
  });

  const jogosDisplayBase =
    dailyLike && diarioLockedMode
      ? jogosBase.filter((j) => Boolean(predictionsMap[j.id]))
      : jogosBase;
  const shouldFilterByGroup = !hasBoloesFlow && grupos.length > 0;
  const matchesGroup = (j: Jogo) =>
    shouldFilterByGroup ? j.grupo === grupo : true;
  const rodadasDisponiveis = Array.from(
    new Set(
      jogosDisplayBase.filter((j) => matchesGroup(j)).map((j) => j.rodada),
    ),
  ).sort((a, b) => a - b);
  const jogosPorRodada = rodadasDisponiveis.map((idx) => {
    const jogosDaRodada = jogosDisplayBase.filter(
      (j) => matchesGroup(j) && j.rodada === idx,
    );
    return {
      label: rodadaLabel(idx),
      jogos: jogosDaRodada,
    };
  });
  const showGroupedByGroup = hasBoloesFlow && bolaoType === "principal";
  const debugInfo = {
    ticketId,
    bolaoType,
    totalJogos: jogos.length,
    diarioPlayableDate,
    jogosBase: jogosBase.length,
    jogosDisplayBase: jogosDisplayBase.length,
    rodadasDisponiveis,
    selectedRodada,
    grupos,
    grupo,
    hasBoloesFlow,
    readOnlyMode,
    diarioLockedMode,
    sampleDates: Array.from(
      new Set(jogos.map((j) => j.dataBR).filter(Boolean)),
    ).slice(0, 10),
  };

  useEffect(() => {
    if (rodadasDisponiveis.length === 0) return;
    if (
      selectedRodada == null ||
      !rodadasDisponiveis.includes(selectedRodada)
    ) {
      setSelectedRodada(rodadasDisponiveis[0] ?? null);
      setSelectedDate(null);
    }
  }, [rodadasDisponiveis, selectedRodada]);

  const predictionsLoadedOnce = Object.keys(predictionsMap).length > 0;
  useEffect(() => {
    if (!showGroupedByGroup) return;
    if (selectedRodada === null) return;
    const jogosNaRodadaAtual = jogosDisplayBase.filter(
      (j) => j.rodada === selectedRodada,
    );
    const datas = Array.from(new Set(jogosNaRodadaAtual.map((j) => j.dataBR)))
      .filter(Boolean)
      .sort((a, b) => (brDateToUtcMs(a) ?? 0) - (brDateToUtcMs(b) ?? 0));
    // Pick the first date that still has at least one game without a prediction
    const nextPending = datas.find((d) =>
      jogosNaRodadaAtual
        .filter((j) => j.dataBR === d)
        .some((j) => !predictionsMap[j.id]),
    );
    setSelectedDate(nextPending ?? datas[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRodada, predictionsLoadedOnce, showGroupedByGroup]);

  const gruposComJogos = Array.from(
    new Set(jogosDisplayBase.map((j) => j.grupo).filter(Boolean)),
  ).sort();
  // When showGroupedByGroup, filter by selected round and date
  const jogosFiltradosParaGrupos = showGroupedByGroup
    ? jogosDisplayBase.filter((j) => {
        if (selectedRodada !== null && j.rodada !== selectedRodada)
          return false;
        if (selectedDate && j.dataBR !== selectedDate) return false;
        return true;
      })
    : jogosDisplayBase;
  const gruposComJogosFiltrados = Array.from(
    new Set(jogosFiltradosParaGrupos.map((j) => j.grupo).filter(Boolean)),
  ).sort();
  const jogosPorGrupoRodada = gruposComJogosFiltrados.map((groupKey) => {
    const rodadasDoGrupo = Array.from(
      new Set(
        jogosFiltradosParaGrupos
          .filter((j) => j.grupo === groupKey)
          .map((j) => j.rodada),
      ),
    ).sort((a, b) => a - b);
    return {
      groupKey,
      rodadas: rodadasDoGrupo.map((idx) => ({
        label: rodadaLabel(idx),
        jogos: jogosFiltradosParaGrupos.filter(
          (j) => j.grupo === groupKey && j.rodada === idx,
        ),
      })),
    };
  });
  const myRankingPos = rankingRows.find((row) => row.isMe)?.pos ?? null;
  const scrollToGroup = (groupKey: string) => {
    setGrupo(groupKey);
    if (typeof window === "undefined") return;
    const targetId = window.matchMedia("(min-width: 1024px)").matches
      ? `desk-group-${groupKey}`
      : `mob-group-${groupKey}`;
    const el = document.getElementById(targetId);
    if (!el) return;
    // small delay so render happens first when filtering by date/round
    setTimeout(
      () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  };
  const jogosById = useMemo(
    () =>
      jogos.reduce(
        (acc, j) => {
          acc[j.id] = j;
          return acc;
        },
        {} as Record<number, Jogo>,
      ),
    [jogos],
  );

  const BotoesGrupo = ({ className }: { className?: string }) => (
    <div className={className}>
      <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase block mb-2">
        Grupo
      </span>
      {/* Mobile: chunked rows of 6 */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        {Array.from({ length: Math.ceil(grupos.length / 6) }, (_, ri) =>
          grupos.slice(ri * 6, ri * 6 + 6),
        ).map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((g) => (
              <button
                key={g}
                onClick={() => setGrupo(g)}
                className="flex-1 h-9 rounded-lg text-[13px] font-bold transition-all duration-200"
                style={{
                  background:
                    grupo === g
                      ? "linear-gradient(180deg, #E8FF8A 0%, #B1EB0B 100%)"
                      : "#0B0D0C",
                  color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
                  boxShadow:
                    grupo === g ? "0 0 14px rgba(177,235,11,0.45)" : "none",
                }}
              >
                {g}
              </button>
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
              background:
                grupo === g
                  ? "linear-gradient(180deg, #E8FF8A 0%, #B1EB0B 100%)"
                  : "#0B0D0C",
              color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
              boxShadow:
                grupo === g ? "0 0 14px rgba(177,235,11,0.45)" : "none",
            }}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-8 lg:max-w-7xl">
      <div
        className="fixed inset-0 pointer-events-none -z-20"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(177,235,11,0.06) 0%, transparent 24%), linear-gradient(180deg, #090A09 0%, #050605 52%, #020302 100%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage:
            "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.7) 48%, transparent 100%)",
        }}
      />

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
            <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0B0D0C] border border-white/8">
              {(
                [
                  { key: "jogos", label: "Jogos", icon: AlignJustify },
                  { key: "ranking", label: "Ranking", icon: Trophy },
                  { key: "resumo", label: "Resumo", icon: BarChart2 },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setResultTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: resultTab === key ? "#B1EB0B" : "transparent",
                    color:
                      resultTab === key ? "#0E141B" : "rgba(255,255,255,0.45)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0B0D0C] border border-white/8">
              {(
                [
                  { key: "jogos", label: "Jogos", icon: AlignJustify },
                  { key: "tabela", label: "Tabela", icon: BarChart2 },
                  { key: "ranking", label: "Ranking", icon: Trophy },
                  { key: "resumo", label: "Resumo", icon: BarChart2 },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: tab === key ? "#B1EB0B" : "transparent",
                    color: tab === key ? "#0E141B" : "rgba(255,255,255,0.45)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Mobile: filtro grupos (exceto ranking) */}
          {grupos.length > 0 &&
            tab !== "ranking" &&
            tab !== "resumo" &&
            !readOnlyMode &&
            !hasBoloesFlow && (
              <div className="mb-5 lg:hidden">
                <BotoesGrupo />
              </div>
            )}

          {showGroupedByGroup && showJogos && (
            <RoundPhaseNav
              jogos={jogosDisplayBase}
              predictionsMap={predictionsMap}
              selectedRodada={selectedRodada ?? 0}
              onRodada={(r) => {
                setSelectedRodada(r);
                setSelectedDate(null);
              }}
              selectedDate={selectedDate}
              onDate={setSelectedDate}
              grupo={grupo}
              grupos={gruposComJogos}
              onGrupo={scrollToGroup}
            />
          )}

          {/* Desktop: filtro de grupos */}
          {grupos.length > 0 && !readOnlyMode && !hasBoloesFlow && (
            <div className="hidden lg:block mb-6">
              <BotoesGrupo />
            </div>
          )}

          {/* Mobile: conteúdo com tabs — em readOnlyMode usar resultTab (tab principal pode ficar em "jogos" e quebrava Ranking/Resumo) */}
          <div
            key={readOnlyMode ? `result-${resultTab}` : tab}
            className="animate-tab-in lg:hidden"
          >
            {showJogos && (
              <div>
                {erro ? (
                  <div className="flex flex-col items-center py-16">
                    <AlertTriangle
                      className="w-10 h-10 mb-3 text-white/20"
                      strokeWidth={1.5}
                    />
                    <p className="text-white/30 text-sm">
                      Erro ao carregar partidas
                    </p>
                  </div>
                ) : loading || showPredictionsSkeleton ? (
                  <>
                    <CardSkeleton />
                    <CardSkeleton />
                  </>
                ) : jogosPorRodada.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <Disc
                      className="w-10 h-10 mb-3 text-white/20"
                      strokeWidth={1.5}
                    />
                    <p className="text-white/30 text-sm">
                      {dailyLike && diarioLockedMode
                        ? "Nenhum palpite encontrado para este ticket"
                        : hasBoloesFlow
                          ? "Nenhum jogo disponível hoje"
                          : "Nenhum jogo neste grupo"}
                    </p>
                  </div>
                ) : showGroupedByGroup ? (
                  jogosPorGrupoRodada.map(({ groupKey, rodadas }) => (
                    <div
                      key={`group-${groupKey}`}
                      id={`mob-group-${groupKey}`}
                      className="scroll-mt-28"
                    >
                      {rodadas.map(({ label, jogos: rJogos }) => (
                        <div key={`${groupKey}-${label}`}>
                          <div className="flex items-center gap-3 mb-3 mt-1">
                            <span
                              className="text-[11px] font-bold tracking-widest uppercase shrink-0"
                              style={{ color: "rgba(255,255,255,0.45)" }}
                            >
                              {label}
                            </span>
                            <span
                              className="text-[11px] font-bold tracking-widest uppercase shrink-0"
                              style={{ color: "rgba(177,235,11,0.55)" }}
                            >
                              · Grupo {groupKey}
                            </span>
                            <div
                              className="flex-1 h-px"
                              style={{ background: "rgba(255,255,255,0.06)" }}
                            />
                          </div>
                          {rJogos.map((jogo) => (
                            <JogoCard
                              key={jogo.id}
                              jogo={jogo}
                              readOnly={readOnlyMode}
                              ticketId={ticketId}
                              initialPrediction={
                                predictionsMap[jogo.id] ?? null
                              }
                              predictionsLoading={loadingPredictions}
                              bolaoType={bolaoType}
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
                        <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">
                          {label}
                        </span>
                        <div
                          className="flex-1 h-px"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        />
                      </div>
                      {rJogos.map((jogo) => (
                        <JogoCard
                          key={jogo.id}
                          jogo={jogo}
                          readOnly={readOnlyMode}
                          ticketId={ticketId}
                          initialPrediction={predictionsMap[jogo.id] ?? null}
                          predictionsLoading={loadingPredictions}
                          bolaoType={bolaoType}
                          onSavePrediction={savePrediction}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
            {tab === "tabela" && !readOnlyMode && (
              <TabelaView
                grupo={grupo}
                tabela={tabela}
                onGrupo={setGrupo}
                loading={loadingTabela}
              />
            )}
            {showRanking ? (
              <RankingView rows={rankingRows} stats={resumoStats} bolaoType={bolaoType} />
            ) : null}
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
            {showGroupedByGroup && showJogos && (
              <RoundPhaseNav
                jogos={jogosDisplayBase}
                predictionsMap={predictionsMap}
                selectedRodada={selectedRodada ?? 0}
                onRodada={(r) => {
                  setSelectedRodada(r);
                  setSelectedDate(null);
                }}
                selectedDate={selectedDate}
                onDate={setSelectedDate}
                grupo={grupo}
                grupos={gruposComJogos}
                onGrupo={scrollToGroup}
              />
            )}
            {readOnlyMode && (
              <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0B0D0C] border border-white/8 w-[280px]">
                {(
                  [
                    { key: "jogos", label: "Jogos", icon: AlignJustify },
                    { key: "ranking", label: "Ranking", icon: Trophy },
                    { key: "resumo", label: "Resumo", icon: BarChart2 },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setResultTab(key)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                    style={{
                      background: resultTab === key ? "#B1EB0B" : "transparent",
                      color:
                        resultTab === key
                          ? "#0E141B"
                          : "rgba(255,255,255,0.45)",
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
              <RankingView rows={rankingRows} stats={resumoStats} bolaoType={bolaoType} />
            ) : erro ? (
              <div className="flex flex-col items-center py-16">
                <AlertTriangle
                  className="w-10 h-10 mb-3 text-white/20"
                  strokeWidth={1.5}
                />
                <p className="text-white/30 text-sm">
                  Erro ao carregar partidas
                </p>
              </div>
            ) : loading || showPredictionsSkeleton ? (
              <div className="grid grid-cols-2 gap-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : jogosPorRodada.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <details className="mb-4 w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-[11px] text-white/70">
                  <summary className="cursor-pointer font-black uppercase text-primary">
                    Debug diário
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap wrap-break-word text-[12px] leading-relaxed">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </details>
                <Disc
                  className="w-10 h-10 mb-3 text-white/20"
                  strokeWidth={1.5}
                />
                <p className="text-white/30 text-sm">
                  {dailyLike && diarioLockedMode
                    ? "Nenhum palpite encontrado para este ticket"
                    : hasBoloesFlow
                      ? "Nenhum jogo disponível hoje"
                      : "Nenhum jogo neste grupo"}
                </p>
              </div>
            ) : showGroupedByGroup ? (
              jogosPorGrupoRodada.map(({ groupKey, rodadas }) => (
                <div
                  key={`desk-group-${groupKey}`}
                  id={`desk-group-${groupKey}`}
                  className="mb-6 scroll-mt-28"
                >
                  {rodadas.map(({ label, jogos: rJogos }) => (
                    <div key={`desk-${groupKey}-${label}`} className="mb-5">
                      <div className="flex items-center gap-3 mb-4">
                        <span
                          className="text-[11px] font-bold tracking-widest uppercase shrink-0"
                          style={{ color: "rgba(255,255,255,0.45)" }}
                        >
                          {label}
                        </span>
                        <span
                          className="text-[11px] font-bold tracking-widest uppercase shrink-0"
                          style={{ color: "rgba(177,235,11,0.55)" }}
                        >
                          · Grupo {groupKey}
                        </span>
                        <div
                          className="flex-1 h-px"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        />
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
                            bolaoType={bolaoType}
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
                    <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">
                      {label}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
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
                        bolaoType={bolaoType}
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
              bolaoType={bolaoType}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PalpitesClient({
  initialData,
}: {
  initialData: PalpitesInitialData | null;
}) {
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
      <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0B0D0C] border border-white/8">
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
        <div className="h-9 flex-1 rounded-lg bg-white/10" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
