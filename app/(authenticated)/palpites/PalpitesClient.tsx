"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
  Trophy,
  Target,
  CircleCheck,
  Star,
  Bell,
  AlertTriangle,
  Disc,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  X,
  Info,
  Clock,
  Lock,
} from "lucide-react";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";
import { PalpitesRankingTab } from "@/app/(authenticated)/palpites/_components/PalpitesRankingTab";
import { PalpitesJogadoresTab } from "@/app/(authenticated)/palpites/_components/PalpitesJogadoresTab";
import {
  isGratisBolaoExtraTicket,
  useMainBolaoPromoModal,
} from "@/app/shared/MainBolaoPromoContext";
import { PalpitesTopPalpiteiros } from "@/app/(authenticated)/palpites/_components/PalpitesTopPalpiteiros";
import { fetchRankingBoardClient } from "@/lib/ranking/load-board-client";
import type { RankingBoardMeta, RankingBoardRow } from "@/lib/ranking/board-types";
import { calcPredictionPoints } from "./lib/predictionsStorage";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind";
import {
  matchDateMapFromJogos,
  matchDateMapFromJogosWithCompetition,
  resolveDiarioPlayableDate,
} from "@/lib/diario-playable-date";
import { getFootballMainCompetitionId, getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import {
  parseKickoffFromPartidaPayload,
  pickScoreFromPartidaPayload,
} from "@/lib/partida-placar";
import {
  palpiteLockBeforeKickoffMs,
  palpiteUsesFiveMinuteLock,
  type PredictionBolaoType,
} from "@/lib/palpites-kickoff-lock";
import {
  hasOfficialMatchResult,
  isLockedByKickoff,
  isMatchOpenForPalpite,
  palpiteEligibilityFromJogo,
} from "@/lib/palpites-match-open";
import { pickTabelaGruposForPalpites } from "@/lib/tabela-palpites-normalize";
import {
  LIVE_PARTIDAS_POLL_MS,
  partidasUrlWithLiveSync,
} from "@/lib/football/live-sync-client";
import { PalpitesViewTabs } from "@/app/(authenticated)/palpites/_components/PalpitesViewTabs";

// ── Tipos ────────────────────────────────────────────────────
type TabView = "jogos" | "tabela" | "ranking" | "resumo" | "jogadores";
type ResultTabView = "jogos" | "ranking" | "resumo" | "jogadores";
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
/**
 * `idx` aqui é o NÚMERO REAL da rodada (vindo de `Jogo.rodada`), já
 * resolvido por `resolveRodadaNumero` a partir de `matches_cache.rodada` /
 * `round_key`. NÃO somar offset — caso contrário fica off-by-one (ex.: a
 * 17ª rodada apareceria como "18ª Rodada").
 */
function rodadaLabel(idx: number): string {
  return `${idx}ª Rodada`;
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

function palpiteLockUiCopy(bolaoType: PredictionBolaoType): {
  fechadoJaPassou: string;
  faixaForaPrazo: string;
  rankingBloco: string;
} {
  if (palpiteUsesFiveMinuteLock(bolaoType)) {
    return {
      fechadoJaPassou: "Fechado: prazo era até 5 min antes do jogo",
      faixaForaPrazo:
        "O prazo termina 5 minutos antes do apito. Depois disso não dá para apostar nem alterar. Se você não tiver salvo um palpite antes desse horário, não entra nesta partida.",
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

/**
 * Depois deste intervalo desde o apito, não exibimos mais "ao vivo" só com o status da listagem
 * (a API pode ficar em "andamento" e minuto parado — ex.: 2º tempo 63 min com 2h+ de relógio).
 * Default 115 min (alinhado ao MATCH_END_CLOCK no servidor). Ajuste NEXT_PUBLIC_MATCH_DISPLAY_LIVE_MAX_MINUTES.
 */
const DISPLAY_LIVE_MAX_MS_AFTER_KICKOFF = (() => {
  const raw = process.env.NEXT_PUBLIC_MATCH_DISPLAY_LIVE_MAX_MINUTES;
  const n = raw != null && String(raw).trim() !== "" ? Number.parseInt(String(raw).trim(), 10) : 115;
  if (!Number.isFinite(n)) return 115 * 60_000;
  return Math.min(240, Math.max(60, n)) * 60_000;
})();

function isPastDisplayLiveWindow(jogo: Jogo, nowMs: number): boolean {
  const ko = kickoffMsFromJogo(jogo);
  if (ko == null) return false;
  return nowMs > ko + DISPLAY_LIVE_MAX_MS_AFTER_KICKOFF;
}

/** Partida com apito ja dado e ainda sem encerramento oficial (somente leitura / UX). */
function isMatchLiveForDisplay(jogo: Jogo, nowMs: number): boolean {
  const ko = kickoffMsFromJogo(jogo);
  if (ko == null || nowMs < ko) return false;
  if (jogo.status === "encerrado") return false;
  const raw = String(jogo.statusBruto ?? jogo.status ?? "").toLowerCase();
  if (raw.includes("encerr") || raw.includes("finaliz")) return false;
  if (isPastDisplayLiveWindow(jogo, nowMs)) return false;
  return true;
}

/** Aberto para palpite: dentro do prazo, não encerrado e não ao vivo. */
function isJogoEditavelParaPalpite(
  jogo: Jogo,
  bolaoType: PredictionBolaoType,
  nowMs = Date.now(),
): boolean {
  return (
    isMatchOpenForPalpite(palpiteEligibilityFromJogo(jogo), bolaoType, nowMs) &&
    !isMatchLiveForDisplay(jogo, nowMs)
  );
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

/**
 * Resolve o número real da rodada de uma partida:
 *   1) `p.rodada` (vindo direto da coluna `matches_cache.rodada`)
 *   2) `p.round_key` (ex.: "17a-rodada" → 17)
 *   3) `rodadaKey` da chave do objeto (ex.: "17a-rodada" → 17)
 *   4) fallback: índice ordinal (legado, raríssimo).
 */
function parseRodadaNumeroFromKey(key: string): number | null {
  const m = String(key || "").match(/(\d+)[ºoa]?[-]?rodada/i);
  if (m && m[1]) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const any = String(key || "").match(/(\d+)/);
  if (any && any[1]) {
    const n = Number.parseInt(any[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveRodadaNumero(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  jogos: Jogo[];
  grupos: string[];
} {
  if (!fases || typeof fases !== "object") return { jogos: [], grupos: [] };
  const phaseValues = Object.values(fases).filter(
    (value) => value && typeof value === "object",
  ) as Record<string, any>[];
  const grupos = new Set<string>();
  // `resolveRodadaNumero` já devolve o número REAL da rodada — não somamos
  // mais um offset por fase (que era um hack para o índice ordinal).
  const jogos = phaseValues.flatMap((faseData) => {
    return parsePartidas(faseData).map((jogo) => {
      if (jogo.grupo && jogo.grupo !== "GERAL") grupos.add(jogo.grupo);
      return jogo;
    });
  });
  return { jogos, grupos: Array.from(grupos).sort() };
}

/** Card de palpite — referência visual (#111111). */
const PALPITE_CARD_BG = "#111111";
const PALPITE_SCORE_BOX_BG = "#1E1E1E";
const PALPITE_MATCH_PANEL_BG = "#1A1A1A";
const PALPITE_PANEL_BG = "#0C0F0D";

/** Rótulo de status — só texto (sem fundo), maior, itálico e font-black. */
const PALPITE_STATUS_LABEL_CLASS =
  "text-[16px] font-black uppercase italic tracking-wide text-white";
const PALPITE_STATUS_SENT_CLASS =
  "inline-flex items-center gap-1.5 text-[16px] font-black uppercase italic tracking-wide text-primary";

const PALPITE_CARD_TYPE = {
  statusOpen: "text-[14px] font-bold uppercase tracking-wide text-white/50",
  statusLive: "text-[14px] font-black uppercase tracking-wide text-[#FF6B6B]",
  statusResult:
    "text-[14px] font-black uppercase tracking-wide text-primary",
  metaHour: "text-[15px] font-semibold tabular-nums text-white",
  teamSigla: "text-[15px] font-bold uppercase text-white",
  scoreHero:
    "font-black tabular-nums leading-none text-white text-[2.35rem] sm:text-[2.5rem]",
  scoreSep: "mx-1.5 text-2xl font-bold text-white/40",
  bodyMsg: "pt-2 text-center text-[13px] font-medium text-white/45",
} as const;

// ── Escudo do time ────────────────────────────────────────────
function Escudo({
  url,
  alt,
  sigla,
  size = "md",
}: {
  url: string;
  alt: string;
  sigla?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [url]);
  const box =
    size === "sm"
      ? "size-[56px] rounded-[12px] p-2"
      : size === "lg"
        ? "size-[80px] rounded-[16px] p-3"
        : "size-[68px] rounded-[14px] p-2.5";
  const img =
    size === "sm" ? "size-10" : size === "lg" ? "size-14" : "size-12";
  const fallbackLabel = (sigla?.trim() || alt).slice(0, 3).toUpperCase();
  const showImg = Boolean(url?.trim()) && !imgFailed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden ${box}`}
      style={{ background: "rgba(255,255,255,0.96)" }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={`${img} object-contain`}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className={`font-black uppercase text-[#0E141B] ${size === "lg" ? "text-[15px]" : size === "sm" ? "text-[11px]" : "text-[13px]"}`}
        >
          {fallbackLabel}
        </span>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl animate-pulse px-5 py-4"
      style={{ background: PALPITE_CARD_BG }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-4 w-12 rounded bg-white/10" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-2">
          <div className="size-20 rounded-2xl bg-white/10" />
          <div className="h-3 w-10 rounded bg-white/10" />
        </div>
        <div className="flex gap-2">
          <div
            className="h-[72px] w-[52px] rounded-xl"
            style={{ background: PALPITE_SCORE_BOX_BG }}
          />
          <div
            className="h-[72px] w-[52px] rounded-xl"
            style={{ background: PALPITE_SCORE_BOX_BG }}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="size-20 rounded-2xl bg-white/10" />
          <div className="h-3 w-10 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function RodadaSectionHeader({
  label,
  groupKey,
}: {
  label: string;
  groupKey?: string;
}) {
  return (
    <p className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em]">
      <span className="text-white">{label}</span>
      {groupKey ? (
        <>
          <span className="text-white"> — </span>
          <span className="text-primary">GRUPO {groupKey}</span>
        </>
      ) : null}
    </p>
  );
}

// ── Score animado ─────────────────────────────────────────────
function ScoreDisplay({
  value,
  dir,
  unset = false,
}: {
  value: number | null;
  dir: "up" | "down";
  unset?: boolean;
}) {
  const showDash = unset || value === null;
  return (
    <div className="flex min-h-[32px] flex-1 w-full items-center justify-center">
      <span
        key={showDash ? "unset" : value}
        className={`font-black tabular-nums leading-none text-[32px] ${showDash ? "text-white/35" : "text-white"} ${!showDash && (dir === "up" ? "animate-score-up" : "animate-score-down")}`}
      >
        {showDash ? "—" : value}
      </span>
    </div>
  );
}

/** Stepper vertical — setas brancas; traço (—) até o usuário definir o placar. */
function VertScoreStepper({
  value,
  dir,
  onInc,
  onDec,
  disabled,
}: {
  value: number | null;
  dir: "up" | "down";
  onInc: () => void;
  onDec: () => void;
  disabled?: boolean;
}) {
  const atUnset = value === null;
  const stepperBtn =
    "flex h-7 w-full shrink-0 items-center justify-center text-white transition active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div
      className="flex w-[52px] shrink-0 flex-col gap-4 items-center rounded-xl p-2 border border-white/10"
      style={{ background: "#000000" }}
    >
      <button
        type="button"
        onClick={onInc}
        disabled={disabled}
        aria-label="Aumentar gols"
        className={stepperBtn}
      >
        <ChevronUp className="size-8" strokeWidth={1.5} aria-hidden />
      </button>
      <ScoreDisplay value={value} dir={dir} unset={atUnset} />
      <button
        type="button"
        onClick={onDec}
        disabled={disabled || atUnset}
        aria-label="Diminuir gols"
        className={stepperBtn}
      >
        <ChevronDown className="size-8" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

type JogoCardScores = { scoreCasa: number | null; scoreVisitante: number | null };

const EMPTY_JOGO_CARD_SCORES: JogoCardScores = {
  scoreCasa: null,
  scoreVisitante: null,
};

function scoresAreComplete(
  scores: JogoCardScores,
): scores is { scoreCasa: number; scoreVisitante: number } {
  return scores.scoreCasa !== null && scores.scoreVisitante !== null;
}

/** Todos os jogos do bolão (escopo da tela) com palpite salvo — fim do fluxo grátis. */
function allJogosHavePalpite(
  jogos: Jogo[],
  predictions: Record<number, { scoreCasa: number; scoreVisitante: number }>,
): boolean {
  if (jogos.length === 0) return false;
  return jogos.every((j) => {
    const p = predictions[j.id];
    return (
      p != null &&
      Number.isFinite(p.scoreCasa) &&
      Number.isFinite(p.scoreVisitante)
    );
  });
}

function stepScoreUp(value: number | null): number {
  if (value === null) return 0;
  return Math.min(value + 1, 99);
}

function stepScoreDown(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 0) return null;
  return value - 1;
}

type PalpitesFooterMode = "initial" | "edit-locked" | "editing";

/** Ações inline abaixo da lista de jogos (não fixo — respeita NavBottom). */
function PalpitesListFooter({
  mode,
  disabled,
  loading,
  saveDisabled,
  error,
  onEdit,
  onSave,
  onCancel,
}: {
  mode: PalpitesFooterMode;
  disabled?: boolean;
  loading?: boolean;
  /** Sem alterações pendentes — desabilita Salvar. */
  saveDisabled?: boolean;
  error?: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const saveBlocked = disabled || loading || saveDisabled;
  const primaryBtn =
    "flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-black uppercase tracking-wide text-[#0E141B] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1A1A1A] disabled:text-white/25 disabled:shadow-none";
  const primaryShadow =
    disabled || loading ? "none" : "0 0 20px rgba(177,235,11,0.28)";

  return (
    <div className="mt-6 space-y-3">
      {error ? (
        <p className="text-center text-sm leading-relaxed text-red-300">{error}</p>
      ) : null}
      {mode === "initial" ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saveBlocked}
          className={`${primaryBtn} w-full flex-none`}
          style={{ boxShadow: primaryShadow }}
        >
          {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {loading ? "Salvando..." : "Salvar palpites"}
        </button>
      ) : mode === "edit-locked" ? (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className={`${primaryBtn} w-full flex-none`}
          style={{ boxShadow: primaryShadow }}
        >
          Editar palpites
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex min-h-[52px] shrink-0 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-bold uppercase tracking-wide text-white/70 transition active:scale-[0.98] disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveBlocked}
            className={primaryBtn}
            style={{ boxShadow: primaryShadow }}
          >
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {loading ? "Salvando..." : "Salvar palpites"}
          </button>
        </div>
      )}
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
  const ptsLabel =
    review.points === 1 ? "+1 ponto" : review.points > 0 ? `+${review.points} pontos` : "0 pontos";

  if (review.exact) {
    return {
      title: `Placar exato · ${ptsLabel}`,
      subtitle: "Acertou o placar completo.",
      tone: "win",
    };
  }
  if (review.outcomeHit) {
    const realDraw = realCasa === realVis;
    const titleBase =
      review.goalsHitCount >= 1
        ? "Vencedor + gols de 1 time"
        : realDraw
          ? "Acertou o empate"
          : "Acertou o vencedor";
    const subtitle =
      review.goalsHitCount >= 1
        ? "Acertou o vencedor e os gols de um time."
        : "Acertou vencedor ou empate.";
    return {
      title: `${titleBase} · ${ptsLabel}`,
      subtitle,
      tone: "win",
    };
  }
  if (review.points > 0) {
    return {
      title: `Gols de 1 time · ${ptsLabel}`,
      subtitle:
        review.goalsHitCount >= 2
          ? "Acertou os gols dos dois times, sem o resultado."
          : "Acertou os gols de apenas um time.",
      tone: "partial",
    };
  }
  return {
    title: "Sem pontos",
    subtitle: `Resultado ${realCasa} × ${realVis} · palpite ${predCasa} × ${predVis}.`,
    tone: "miss",
  };
}

type PalpitePontosLinha = { label: string; hit: boolean; points: number };

function palpitePontosBreakdown(
  review: ReturnType<typeof calcPredictionPoints>,
  predCasa: number,
  predVisitante: number,
  realCasa: number,
  realVisitante: number,
): PalpitePontosLinha[] {
  const golsCasa = predCasa === realCasa;
  const golsVis = predVisitante === realVisitante;

  if (review.exact) {
    return [
      { label: "Placar exato", hit: true, points: 6 },
      { label: "Acertou o vencedor", hit: true, points: 0 },
      { label: "Gols de 1 time (casa)", hit: true, points: 0 },
      { label: "Gols de 1 time (visitante)", hit: true, points: 0 },
    ];
  }

  if (review.outcomeHit) {
    const bonusGol = Math.max(0, review.points - 3);
    const realDraw = realCasa === realVisitante;
    return [
      {
        label: realDraw ? "Acertou o empate" : "Acertou o vencedor",
        hit: true,
        points: 3,
      },
      { label: "Placar exato", hit: false, points: 0 },
      {
        label: "Gols de 1 time (casa)",
        hit: golsCasa,
        points: golsCasa && bonusGol > 0 ? 1 : 0,
      },
      {
        label: "Gols de 1 time (visitante)",
        hit: golsVis,
        points: golsVis && bonusGol > 0 ? 1 : 0,
      },
    ];
  }

  return [
    { label: "Acertou o vencedor", hit: false, points: 0 },
    { label: "Placar exato", hit: false, points: 0 },
    { label: "Gols de 1 time (casa)", hit: golsCasa, points: golsCasa ? 1 : 0 },
    {
      label: "Gols de 1 time (visitante)",
      hit: golsVis,
      points: golsVis ? 1 : 0,
    },
  ];
}

function formatPontosLabel(n: number): string {
  if (n === 0) return "0 pts";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n} pt${Math.abs(n) === 1 ? "" : "s"}`;
}

type JogoCardPhase = "pre" | "live" | "post";

function formatKickoffHourOnly(jogo: Jogo): string {
  const fromHora = safeHourLabel(jogo.hora);
  if (fromHora !== "--:--") return fromHora;
  if (!jogo.kickoffAt) return "--:--";
  const dt = new Date(jogo.kickoffAt);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(dt);
}

/** Contagem até fechar palpites — texto curto (dias → horas → minutos). */
function formatCountdownCompact(lockAtMs: number | null, nowMs: number): string {
  if (lockAtMs == null) return "Aberto";
  const diff = lockAtMs - nowMs;
  if (diff <= 0) return "Fechado";

  const totalMins = Math.floor(diff / 60_000);
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  if (days >= 1) {
    return days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`;
  }
  if (hours >= 1) {
    return hours === 1 ? "Falta 1h" : `Faltam ${hours}h`;
  }
  if (mins >= 1) {
    return mins === 1 ? "Falta 1 min" : `Faltam ${mins} min`;
  }
  const secs = Math.max(1, Math.floor(diff / 1000));
  return secs === 1 ? "Falta 1 seg" : `Faltam ${secs} seg`;
}

function getJogoCardPhase(jogo: Jogo, nowMs: number): JogoCardPhase {
  const temPlacar = hasOfficialMatchResult(palpiteEligibilityFromJogo(jogo), nowMs);
  if (isMatchLiveForDisplay(jogo, nowMs)) return "live";
  if (temPlacar) return "post";
  return "pre";
}

function getLiveMinuteBadge(jogo: Jogo, nowMs: number): string {
  if (jogo.liveMinuto != null) return `${jogo.liveMinuto}'`;
  const label = formatLiveClockLabel(jogo, nowMs);
  if (!label) return "Ao vivo";
  const m = label.match(/(\d+)\s*min/);
  if (m) return `${m[1]}'`;
  return label.replace(/·/g, "").trim();
}

function PalpiteScoreBox({
  value,
  unset = false,
}: {
  value: number;
  unset?: boolean;
}) {
  return (
    <span
      className={`flex h-[72px] w-[52px] items-center justify-center rounded-xl font-black tabular-nums text-[32px] leading-none ${unset ? "text-white/35" : "text-white"}`}
      style={{ background: PALPITE_SCORE_BOX_BG }}
    >
      {unset ? "—" : value}
    </span>
  );
}

function PalpiteScoreBoxes({
  casa,
  visitante,
}: {
  casa: number;
  visitante: number;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label="Placar do palpite"
    >
      <PalpiteScoreBox value={casa} />
      <span className="text-[15px] font-bold text-white/50" aria-hidden>
        x
      </span>
      <PalpiteScoreBox value={visitante} />
    </div>
  );
}

function PalpiteEmptyScoreBoxes() {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label="Palpite ainda não definido"
    >
      <PalpiteScoreBox value={0} unset />
      <span className="text-[15px] font-bold text-white/50" aria-hidden>
        x
      </span>
      <PalpiteScoreBox value={0} unset />
    </div>
  );
}

function PalpiteCardTeamColumn({
  url,
  alt,
  sigla,
}: {
  url: string;
  alt: string;
  sigla?: string;
}) {
  const label = (sigla?.trim() || alt).slice(0, 3).toUpperCase();
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <Escudo url={url} alt={alt} sigla={sigla} size="lg" />
      <p className={PALPITE_CARD_TYPE.teamSigla}>{label}</p>
    </div>
  );
}

const PALPITE_LIVE_BADGE_RED = "#D94E44";

function formatLiveStatusBadge(jogo: Jogo, nowMs: number): string {
  const raw = (jogo.statusBruto ?? "").toLowerCase();
  if (raw.includes("intervalo")) {
    const min = jogo.liveMinuto != null ? `${jogo.liveMinuto}'` : "";
    return ["AO VIVO", min, "INT"].filter(Boolean).join(" ");
  }

  let min = jogo.liveMinuto != null ? `${jogo.liveMinuto}'` : "";
  let tempo =
    jogo.liveTempo === 1 ? "1T" : jogo.liveTempo === 2 ? "2T" : "";

  if (!tempo && jogo.liveMinuto != null) {
    tempo = jogo.liveMinuto <= 45 ? "1T" : "2T";
  }

  if (!min || !tempo) {
    const label = formatLiveClockLabel(jogo, nowMs);
    if (label && label !== "Intervalo") {
      const mm = label.match(/(\d+)\s*min/);
      if (!min && mm) min = `${mm[1]}'`;
      if (!tempo) {
        if (label.includes("1º tempo")) tempo = "1T";
        else if (label.includes("2º tempo")) tempo = "2T";
      }
    }
  }

  return ["AO VIVO", min, tempo].filter(Boolean).join(" ");
}

function PalpiteCardLiveBadge({ label }: { label: string }) {
  return (
    <div className="flex justify-center px-5 pt-4 pb-1">
      <span
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-black uppercase leading-none tracking-wide text-white"
        style={{ backgroundColor: PALPITE_LIVE_BADGE_RED }}
        role="status"
        aria-live="polite"
      >
        <span className="size-[7px] shrink-0 rounded-full bg-white" aria-hidden />
        {label}
      </span>
    </div>
  );
}

function PalpiteResultadoFinalBadge() {
  return (
    <span className="mb-2 inline-flex rounded-md bg-primary px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#0E141B]">
      RESULTADO FINAL
    </span>
  );
}

function PalpiteSeuPalpiteLine({
  casa,
  visitante,
}: {
  casa: number;
  visitante: number;
}) {
  return (
    <p className="mt-4 text-center text-[15px] font-black uppercase italic tracking-wide text-primary">
      SEU PALPITE : {casa} X {visitante}
    </p>
  );
}

function PalpiteCardStatusBar({
  countdownLabel,
  kickoffHour,
  palpiteEnviado,
  semPalpite,
}: {
  countdownLabel: string;
  kickoffHour: string;
  palpiteEnviado: boolean;
  semPalpite: boolean;
}) {
  const hourSlot = (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 ${PALPITE_CARD_TYPE.metaHour}`}
    >
      <Clock className="size-3.5 shrink-0 text-white" strokeWidth={2.2} aria-hidden />
      {kickoffHour}
    </span>
  );

  if (palpiteEnviado) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <span className={PALPITE_STATUS_SENT_CLASS}>
          <Lock className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          PALPITE ENVIADO
        </span>
        {hourSlot}
      </div>
    );
  }

  if (semPalpite) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <span className={PALPITE_STATUS_LABEL_CLASS}>SEM PALPITE</span>
        {hourSlot}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4">
      <span className={PALPITE_CARD_TYPE.statusOpen}>
        {countdownLabel}
      </span>
      {hourSlot}
    </div>
  );
}

function PontosBreakdownIcon({ hit }: { hit: boolean }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-2 ${hit
        ? "bg-[#0AC96B] ring-[#0AC96B]/35"
        : "bg-[#EF4444] ring-[#EF4444]/30"
        }`}
      aria-hidden
    >
      {hit ? (
        <Check className="size-3.5 text-white" strokeWidth={3} />
      ) : (
        <X className="size-3.5 text-white" strokeWidth={3} />
      )}
    </span>
  );
}

function PalpitePontuacaoBreakdown({
  expanded,
  onToggle,
  review,
  linhas,
  headlineMode = "final",
}: {
  expanded: boolean;
  onToggle: () => void;
  review: ReturnType<typeof calcPredictionPoints>;
  linhas: PalpitePontosLinha[];
  headlineMode?: "final" | "live";
}) {
  const ptsHeadline =
    review.points > 0 ? `+${review.points}` : String(review.points);
  const ptsText =
    review.points > 0
      ? `+${review.points} pontos`
      : `${review.points} pontos`;
  const headlineLabel =
    headlineMode === "live" ? "Pontuação parcial" : "Pontuação final";

  return (
    <div className="mx-5 mb-5">
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: PALPITE_MATCH_PANEL_BG }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition active:scale-[0.99]"
        >
          <p className="min-w-0 text-[15px] font-semibold text-white">
            {headlineLabel} :{" "}
            <span className="font-black text-primary">{ptsText}</span>
          </p>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[32px] font-black leading-none tabular-nums text-primary">
              {ptsHeadline}
            </span>
            <ChevronDown
              className={`size-5 shrink-0 text-white/45 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              strokeWidth={2.5}
              aria-hidden
            />
          </span>
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <ul
              className="border-t border-white/8"
              aria-label="Detalhamento da pontuação"
            >
              {linhas.map((linha, idx) => (
                <li
                  key={linha.label}
                  className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3.5 ${idx > 0 ? "border-t border-white/6" : ""}`}
                >
                  <span className="text-[14px] font-semibold text-white">
                    {linha.label}
                  </span>
                  <PontosBreakdownIcon hit={linha.hit} />
                  <span
                    className={`min-w-14 text-right text-[14px] font-black tabular-nums ${linha.points > 0 ? "text-primary" : "text-white/35"}`}
                  >
                    {formatPontosLabel(linha.points)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function JogoCard({
  jogo,
  readOnly = false,
  editingEnabled = false,
  scores,
  onScoresChange,
  onSavePalpite,
  savingPalpite = false,
  savePalpiteError = null,
  initialPrediction,
  predictionsLoading = false,
  bolaoType,
}: {
  jogo: Jogo;
  readOnly?: boolean;
  editingEnabled?: boolean;
  scores: JogoCardScores;
  onScoresChange?: (scores: JogoCardScores) => void;
  onSavePalpite?: () => void;
  savingPalpite?: boolean;
  savePalpiteError?: string | null;
  initialPrediction?: { scoreCasa: number; scoreVisitante: number } | null;
  predictionsLoading?: boolean;
  bolaoType: PredictionBolaoType;
}) {
  const { scoreCasa, scoreVisitante } = scores;

  const lockLeadMs = palpiteLockBeforeKickoffMs(bolaoType);
  const lockAtMs = jogo.kickoffAt
    ? new Date(jogo.kickoffAt).getTime() - lockLeadMs
    : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    if (lockAtMs != null) {
      const msUntilLock = lockAtMs - Date.now();
      const interval =
        msUntilLock < 60_000
          ? 1000
          : msUntilLock < 60 * 60_000
            ? 30_000
            : 60_000;
      const id = setInterval(tick, interval);
      return () => clearInterval(id);
    }
    if (jogo.kickoffAt) {
      const awaitingPlacar =
        readOnly && (jogo.resultCasa == null || jogo.resultVisitante == null);
      const id = setInterval(tick, awaitingPlacar ? 30_000 : 60_000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [lockAtMs, jogo.kickoffAt, readOnly, jogo.resultCasa, jogo.resultVisitante]);
  const isLockedByTime = lockAtMs != null ? nowMs >= lockAtMs : false;
  /** Palpite até instantes antes do apito (5 min Copa/Skale/extra; 1h no diário). */
  const matchOpen = isMatchOpenForPalpite(
    palpiteEligibilityFromJogo(jogo),
    bolaoType,
    nowMs,
  );
  const canEdit = editingEnabled && matchOpen && !isLockedByTime;

  const hasInitialPrediction = Boolean(initialPrediction);
  const canChangeScores = Boolean(onScoresChange);
  const [dirCasa, setDirCasa] = useState<"up" | "down">("up");
  const [dirVisitante, setDirVisitante] = useState<"up" | "down">("up");

  function increment(side: "casa" | "visitante") {
    if (!onScoresChange) return;
    if (side === "casa") {
      setDirCasa("up");
      onScoresChange({
        scoreCasa: stepScoreUp(scoreCasa),
        scoreVisitante,
      });
    } else {
      setDirVisitante("up");
      onScoresChange({
        scoreCasa,
        scoreVisitante: stepScoreUp(scoreVisitante),
      });
    }
  }
  function decrement(side: "casa" | "visitante") {
    if (!onScoresChange) return;
    if (side === "casa") {
      setDirCasa("down");
      onScoresChange({
        scoreCasa: stepScoreDown(scoreCasa),
        scoreVisitante,
      });
    } else {
      setDirVisitante("down");
      onScoresChange({
        scoreCasa,
        scoreVisitante: stepScoreDown(scoreVisitante),
      });
    }
  }

  const stepperDisabled =
    readOnly || !canChangeScores || !editingEnabled || predictionsLoading;
  const phase = getJogoCardPhase(jogo, nowMs);
  const kickoffHour = formatKickoffHourOnly(jogo);
  const countdownLabel = formatCountdownCompact(lockAtMs, nowMs);
  const [pontosExpanded, setPontosExpanded] = useState(false);

  const temPlacarOficial = hasOfficialMatchResult(
    palpiteEligibilityFromJogo(jogo),
    nowMs,
  );
  const palpiteCasa = scoreCasa ?? 0;
  const palpiteVisitante = scoreVisitante ?? 0;
  const displayCasa = phase === "post" ? jogo.resultCasa! : palpiteCasa;
  const displayVisitante =
    phase === "post" ? jogo.resultVisitante! : palpiteVisitante;
  const canReviewPoints =
    (phase === "live" || phase === "post") &&
    hasInitialPrediction &&
    temPlacarOficial &&
    scoresAreComplete(scores) &&
    jogo.resultCasa != null &&
    jogo.resultVisitante != null;
  const review = canReviewPoints
    ? calcPredictionPoints(
        scores.scoreCasa,
        scores.scoreVisitante,
        jogo.resultCasa!,
        jogo.resultVisitante!,
      )
    : null;

  const koMs = kickoffMsFromJogo(jogo);
  const beforeKickoff = koMs != null && nowMs < koMs;
  const matchLive = isMatchLiveForDisplay(jogo, nowMs);
  /** Antes do apito: qualquer jogo na rodada (nao so o primeiro da lista). */
  const readOnlyPending = readOnly && beforeKickoff;
  const readOnlyMatchLive = readOnly && matchLive;
  const readOnlyPlacarPendente =
    readOnly &&
    !readOnlyPending &&
    !readOnlyMatchLive &&
    !temPlacarOficial &&
    jogo.status === "encerrado";
  /** API/listagem ainda diz "andamento" mas já passou o tempo razoável de partida — aguardando placar na cache. */
  const readOnlyAguardandoPlacarPosTempo =
    readOnly &&
    !readOnlyPending &&
    !readOnlyMatchLive &&
    !readOnlyPlacarPendente &&
    !temPlacarOficial &&
    koMs != null &&
    nowMs >= koMs;
  const showResultadoDetalhado =
    (phase === "live" || phase === "post") &&
    hasInitialPrediction &&
    review != null;
  const pontosLinhas =
    review != null && temPlacarOficial && initialPrediction
      ? palpitePontosBreakdown(
        review,
        initialPrediction.scoreCasa,
        initialPrediction.scoreVisitante,
        jogo.resultCasa!,
        jogo.resultVisitante!,
      )
      : [];

  const liveCasa = jogo.resultCasa ?? 0;
  const liveVisit = jogo.resultVisitante ?? 0;
  const palpiteLocked =
    phase !== "pre" || !canEdit || isLockedByTime || readOnly;
  const palpiteEnviado =
    hasInitialPrediction && (palpiteLocked || phase !== "pre");
  const semPalpite = phase === "pre" && !hasInitialPrediction;
  const showSteppers =
    phase === "pre" &&
    canChangeScores &&
    !predictionsLoading &&
    !palpiteEnviado;
  const showSeuPalpite =
    (phase === "live" || phase === "post") && hasInitialPrediction;
  const liveBadgeLabel = formatLiveStatusBadge(jogo, nowMs);
  const showPreHeader = phase === "pre";
  const showPreDivider = showPreHeader && (palpiteEnviado || semPalpite);

  const centerScores = (() => {
    if (predictionsLoading) {
      return (
        <div className="flex items-center justify-center gap-2">
          <div
            className="h-[72px] w-[52px] animate-pulse rounded-xl"
            style={{ background: PALPITE_SCORE_BOX_BG }}
          />
          <span className="text-[15px] font-bold text-white/50" aria-hidden>
            x
          </span>
          <div
            className="h-[72px] w-[52px] animate-pulse rounded-xl"
            style={{ background: PALPITE_SCORE_BOX_BG }}
          />
        </div>
      );
    }
    if (phase === "post") {
      return (
        <PalpiteScoreBoxes casa={displayCasa} visitante={displayVisitante} />
      );
    }
    if (phase === "live") {
      return <PalpiteScoreBoxes casa={liveCasa} visitante={liveVisit} />;
    }
    if (showSteppers) {
      return (
        <div className="flex items-center justify-center gap-2">
          <VertScoreStepper
            value={scoreCasa}
            dir={dirCasa}
            onInc={() => increment("casa")}
            onDec={() => decrement("casa")}
            disabled={stepperDisabled}
          />
          <VertScoreStepper
            value={scoreVisitante}
            dir={dirVisitante}
            onInc={() => increment("visitante")}
            onDec={() => decrement("visitante")}
            disabled={stepperDisabled}
          />
        </div>
      );
    }
    if (hasInitialPrediction && scoresAreComplete(scores)) {
      return (
        <PalpiteScoreBoxes
          casa={scores.scoreCasa}
          visitante={scores.scoreVisitante}
        />
      );
    }
    return <PalpiteEmptyScoreBoxes />;
  })();

  const footerMsg = (() => {
    if (phase !== "pre") return null;
    if (readOnlyPending) return "Aguardando o início da partida.";
    if (readOnlyPlacarPendente || readOnlyAguardandoPlacarPosTempo) {
      return "Estamos sincronizando o placar oficial. Volte em instantes.";
    }
    if (isLockedByTime) return "Prazo encerrado para novos palpites.";
    if (!hasInitialPrediction && readOnly) {
      return "Você não fez palpite nesta partida.";
    }
    return null;
  })();

  const bodyPadding =
    phase === "pre"
      ? "p-6"
      : "px-5 pb-5 pt-2";

  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl"
      style={{ background: PALPITE_CARD_BG }}
    >
      {phase === "live" ? (
        <PalpiteCardLiveBadge label={liveBadgeLabel} />
      ) : showPreHeader ? (
        <>
          <PalpiteCardStatusBar
            countdownLabel={countdownLabel}
            kickoffHour={kickoffHour}
            palpiteEnviado={palpiteEnviado}
            semPalpite={semPalpite}
          />
          {showPreDivider ? (
            <div className="mx-5 border-b border-white/10" />
          ) : null}
        </>
      ) : null}

      <div className={bodyPadding}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <PalpiteCardTeamColumn
            url={jogo.escudoCasa}
            alt={jogo.timeCasa}
            sigla={jogo.siglasCasa}
          />
          <div className="flex flex-col items-center justify-center px-1">
            {phase === "post" ? <PalpiteResultadoFinalBadge /> : null}
            {centerScores}
          </div>
          <PalpiteCardTeamColumn
            url={jogo.escudoVisitante}
            alt={jogo.timeVisitante}
            sigla={jogo.siglasVisitante}
          />
        </div>
        {showSeuPalpite && initialPrediction ? (
          <PalpiteSeuPalpiteLine
            casa={initialPrediction.scoreCasa}
            visitante={initialPrediction.scoreVisitante}
          />
        ) : null}
      </div>

      {showSteppers && onSavePalpite ? (
        <div className="hidden lg:block px-6 pb-6 -mt-2">
          {savePalpiteError ? (
            <p className="mb-2 text-center text-[12px] font-semibold text-red-300">
              {savePalpiteError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSavePalpite}
            disabled={savingPalpite || !scoresAreComplete(scores)}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1A1A1A] disabled:text-white/25"
          >
            {savingPalpite ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {savingPalpite ? "Salvando..." : "Salvar palpite"}
          </button>
        </div>
      ) : null}

      {phase === "post" && !hasInitialPrediction ? (
        <p className={`px-5 pb-4 ${PALPITE_CARD_TYPE.bodyMsg}`}>
          Você não fez palpite nesta partida.
        </p>
      ) : null}

      {showResultadoDetalhado && review ? (
        <PalpitePontuacaoBreakdown
          expanded={pontosExpanded}
          onToggle={() => setPontosExpanded((v) => !v)}
          review={review}
          linhas={pontosLinhas}
          headlineMode={phase === "live" ? "live" : "final"}
        />
      ) : null}

      {footerMsg ? (
        <p className={`px-5 pb-4 ${PALPITE_CARD_TYPE.bodyMsg}`}>{footerMsg}</p>
      ) : null}
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
  let times = tabela[grupoKey] ?? [];
  if (!times.length && tabela["grupo-geral"]?.length) {
    times = tabela["grupo-geral"];
  }
  const todosGrupos = Object.entries(tabela)
    .filter(([k]) => k.startsWith("grupo-"))
    .sort(([a], [b]) => a.localeCompare(b));
  const tituloGrupo =
    todosGrupos.length === 1 && todosGrupos[0]?.[0] === "grupo-geral"
      ? "Classificação"
      : `Classificação — Grupo ${grupo}`;

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
          className="flex items-center justify-between px-4 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[16px] font-bold text-white min-[380px]:text-[17px]">
            {tituloGrupo}
          </span>
          <div className="flex gap-3 sm:gap-4">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span
                key={col}
                className="w-7 text-center text-[12px] font-bold text-white/45 min-[380px]:text-[13px]"
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
            className="flex items-center justify-between px-4 py-3.5"
            style={{
              background: i < 2 ? "rgba(177,235,11,0.04)" : "transparent",
              borderBottom:
                i < times.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[12px] font-bold min-[380px]:text-[13px]"
                style={{
                  background:
                    i === 0
                      ? "rgba(177,235,11,0.14)"
                      : "rgba(255,255,255,0.06)",
                  color: i === 0 ? "#B1EB0B" : "rgba(255,255,255,0.5)",
                }}
              >
                {t.posicao}
              </span>
              <div
                className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.time.escudo}
                  alt={t.time.sigla}
                  className="size-6 object-contain"
                />
              </div>
              <span className="text-[15px] font-bold tracking-wide text-white min-[380px]:text-[16px]">
                {t.time.sigla}
              </span>
            </div>
            <div className="flex shrink-0 gap-3 sm:gap-4">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map(
                (val, vi) => (
                  <span
                    key={vi}
                    className="w-7 text-center text-[14px] font-bold tabular-nums min-[380px]:text-[15px]"
                    style={{
                      color: vi === 0 ? "#fff" : "rgba(255,255,255,0.45)",
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

      {/* Seletor de grupos — só quando há mais de um */}
      {todosGrupos.length > 1 && (
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
  /** Cota extra grátis (brinde). */
  isPromoBonus?: boolean;
  extraChampionshipId?: number | null;
  /**
   * Bolão extra "por rodada": valor de `tickets.round_number`.
   *
   * Quando presente, a tela do bolão extra exibe TODOS os jogos dessa rodada
   * (independente do dia) e a API só aceita palpites em jogos da mesma rodada.
   * Quando `null`, mantém o comportamento legado (sem filtro por rodada).
   */
  extraRoundNumber?: number | null;
  /**
   * Nome legível da rodada do bolão extra, vindo de
   * `championships_cache.rodada_atual_nome` (ex.: "17ª Rodada"). Quando ausente,
   * o cliente compõe `${extraRoundNumber}ª Rodada` como fallback.
   */
  extraRoundName?: string | null;
  /** Bolão diário por edição (`tickets.round_number` = 1–11). */
  dailyEditionNumber?: number | null;
  /** Datas dd/MM/yyyy cobertas pela edição do bolão diário. */
  dailyEditionDates?: string[];
  dailyEditionDatesLabel?: string | null;
  /** Bolão da Skale: palpites em todos os jogos da Copa (igual cota principal). */
  isSkaleFullCopaPool?: boolean;
  /** Bolão Diário Skale: mesmas edições/dias do diário Copa (comp 90009). */
  isSkaleDailyEditionPool?: boolean;
  /** Título do bolão na página (SSR). */
  bolaoHeading?: string | null;
  tabela: TabelaGrupos | null;
  jogos: Jogo[];
  grupos: string[];
  grupo: string;
  erro: boolean;
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>;
  resumoStats: ResumoStats;
  historicoRows: HistoricoRowView[];
};

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
  isSkaleFullCopaPool = false,
  stats,
  rankingPos,
  historico,
  loadingHistorico,
  jogosById,
}: {
  ticketId: string | null;
  resultMode: boolean;
  bolaoType: "principal" | "diario" | "extra";
  isSkaleFullCopaPool?: boolean;
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
                  {bolaoType === "principal" || isSkaleFullCopaPool
                    ? "Copa do Mundo 2026 — Copa inteira"
                    : "Copa do Mundo 2026 — jogos do dia"}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-white/80 shrink-0">Regra</span>
                <span className="text-right font-medium text-white/90">
                  {bolaoType === "principal" || isSkaleFullCopaPool
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
                            className={`text-[16px] font-black ${item.pontos > 0 ? "text-[#4ADE80]" : "text-white/40"}`}
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
  rankingBoardRows,
  rankingBoardLoading,
  ticketId,
  stats,
  bolaoType,
  onRankingLinkClick,
}: {
  grupo: string;
  tabela: TabelaGrupos | null;
  grupos: string[];
  onGrupo: (g: string) => void;
  rankingBoardRows: RankingBoardRow[];
  rankingBoardLoading: boolean;
  ticketId: string | null;
  stats: ResumoStats;
  bolaoType: PredictionBolaoType;
  onRankingLinkClick?: () => void;
}) {
  const lockCopy = palpiteLockUiCopy(bolaoType);
  const grupoKey = `grupo-${grupo.toLowerCase()}`;
  let times = tabela ? (tabela[grupoKey] ?? []) : [];
  if (!times.length && tabela?.["grupo-geral"]?.length) {
    times = tabela["grupo-geral"];
  }
  const todosGrupos = tabela
    ? Object.entries(tabela)
      .filter(([k]) => k.startsWith("grupo-"))
      .sort(([a], [b]) => a.localeCompare(b))
    : [];
  const idx = grupos.indexOf(grupo);
  const prev = idx > 0 ? grupos[idx - 1] : null;
  const next = idx < grupos.length - 1 ? grupos[idx + 1] : null;
  const multiplosGrupos = todosGrupos.length > 1;

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
          {multiplosGrupos ? (
            <button
              onClick={() => prev && onGrupo(prev)}
              disabled={!prev}
              className="flex size-6 shrink-0 items-center justify-center rounded-md transition-opacity"
              style={{
                background: "rgba(255,255,255,0.06)",
                opacity: prev ? 1 : 0.25,
              }}
            >
              <ChevronDown className="size-3 rotate-90 text-white/60" />
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden />
          )}

          <span className="min-w-0 flex-1 truncate text-center text-[14px] font-bold text-white">
            {todosGrupos.length === 1 && todosGrupos[0]?.[0] === "grupo-geral"
              ? "Classificação"
              : `Classificação — Grupo ${grupo}`}
          </span>

          {multiplosGrupos ? (
            <button
              onClick={() => next && onGrupo(next)}
              disabled={!next}
              className="flex size-6 shrink-0 items-center justify-center rounded-md transition-opacity"
              style={{
                background: "rgba(255,255,255,0.06)",
                opacity: next ? 1 : 0.25,
              }}
            >
              <ChevronDown className="size-3 -rotate-90 text-white/60" />
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden />
          )}

          <div className="flex shrink-0 gap-2.5">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span
                key={col}
                className="w-6 text-center text-[11px] font-bold text-white/45"
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
            className="flex items-center gap-2.5 px-4 py-3"
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
              className="flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[13px] font-bold"
              style={{
                background:
                  i === 0 ? "rgba(177,235,11,0.14)" : "rgba(255,255,255,0.06)",
                color: i === 0 ? "#B1EB0B" : "rgba(255,255,255,0.5)",
              }}
            >
              {t.posicao}
            </span>
            {/* Escudo */}
            <div
              className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md"
              style={{ background: "rgba(255,255,255,0.92)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.time.escudo}
                alt={t.time.sigla}
                className="size-6 object-contain"
              />
            </div>
            {/* Sigla */}
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">
              {t.time.sigla}
            </span>
            {/* Stats */}
            <div className="flex shrink-0 gap-2.5">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map(
                (val, vi) => (
                  <span
                    key={vi}
                    className="w-6 text-center text-[13px] font-bold tabular-nums"
                    style={{
                      color: vi === 0 ? "#fff" : "rgba(255,255,255,0.45)",
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

      <PalpitesTopPalpiteiros
        rows={rankingBoardRows}
        loading={rankingBoardLoading}
        ticketId={ticketId}
        compact
        onRankingLinkClick={onRankingLinkClick}
      />

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-4">
        <Bell
          className="mt-0.5 size-4 shrink-0 text-primary"
          strokeWidth={2}
          aria-hidden
        />
        <div>
          <p className="text-[12px] font-bold text-primary">Prazo para palpitar</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
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

function dayDiffFromToday(dateBR: string, todayBR: string): number | null {
  const a = brDateToUtcMs(dateBR);
  const b = brDateToUtcMs(todayBR);
  if (a == null || b == null) return null;
  return Math.round((a - b) / 86_400_000);
}

function formatPalpiteDateChipLabel(dateBR: string, todayBR: string): string {
  const diff = dayDiffFromToday(dateBR, todayBR);
  if (diff === -1) return "Ontem";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  const fmt = parseDatePill(dateBR);
  if (!fmt) return dateBR;
  const wd =
    fmt.diaSemana.length >= 3
      ? fmt.diaSemana.charAt(0) + fmt.diaSemana.slice(1, 3).toLowerCase()
      : fmt.diaSemana;
  const mes =
    fmt.mes.length >= 3
      ? fmt.mes.charAt(0) + fmt.mes.slice(1, 3).toLowerCase()
      : fmt.mes;
  return `${wd} ${fmt.dia}. ${mes}`;
}

function sortedRoundDates(jogos: Jogo[], rodada: number): string[] {
  return Array.from(
    new Set(
      jogos.filter((j) => j.rodada === rodada).map((j) => j.dataBR),
    ),
  )
    .filter(Boolean)
    .sort((a, b) => (brDateToUtcMs(a) ?? 0) - (brDateToUtcMs(b) ?? 0));
}

function isRoundDayComplete(
  jogos: Jogo[],
  rodada: number,
  dateBR: string,
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>,
): boolean {
  const dayGames = jogos.filter((j) => j.rodada === rodada && j.dataBR === dateBR);
  return (
    dayGames.length > 0 &&
    dayGames.every((j) => Boolean(predictionsMap[j.id]))
  );
}

/** Após concluir o dia atual, avança para o próximo dia da rodada (ex.: sex → sáb). */
function pickNextDateInRound(
  jogos: Jogo[],
  rodada: number,
  currentDate: string | null,
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>,
): string | null {
  const datas = sortedRoundDates(jogos, rodada);
  if (datas.length === 0) return null;

  if (
    currentDate &&
    datas.includes(currentDate) &&
    !isRoundDayComplete(jogos, rodada, currentDate, predictionsMap)
  ) {
    return currentDate;
  }

  const startIdx =
    currentDate && datas.includes(currentDate)
      ? datas.indexOf(currentDate) + 1
      : 0;

  for (let i = startIdx; i < datas.length; i++) {
    const d = datas[i]!;
    const hasPending = jogos
      .filter((j) => j.rodada === rodada && j.dataBR === d)
      .some((j) => !predictionsMap[j.id]);
    if (hasPending) return d;
  }

  if (startIdx < datas.length) return datas[startIdx] ?? null;
  return currentDate ?? datas[0] ?? null;
}

// ── Barra de progresso da rodada ───────────────────────────────
function RoundProgressBar({
  jogos,
  selectedRodada,
  hasPalpite,
}: {
  jogos: Jogo[];
  selectedRodada: number;
  hasPalpite: (matchId: number) => boolean;
}) {
  const jogosNaRodada = useMemo(
    () => jogos.filter((j) => j.rodada === selectedRodada),
    [jogos, selectedRodada],
  );
  const totalJogos = jogosNaRodada.length;
  const jogosPalpitados = jogosNaRodada.filter((j) => hasPalpite(j.id)).length;
  const pct =
    totalJogos > 0 ? Math.round((jogosPalpitados / totalJogos) * 100) : 0;
  const countDisplay =
    jogosPalpitados > 0
      ? String(jogosPalpitados).padStart(2, "0")
      : String(jogosPalpitados);

  return (
    <div className="rounded-2xl bg-zinc-900 px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[15px] leading-snug text-white">
          <span
            className="font-black tabular-nums"
            style={{
              color: jogosPalpitados > 0 ? "#B1EB0B" : "#FFFFFF",
            }}
          >
            {countDisplay}
          </span>
          <span className="font-bold tabular-nums text-white">
            {" "}
            / {totalJogos}
          </span>
          <span className="font-bold text-white"> Palpites feitos</span>
        </p>
        <span className="shrink-0 text-[15px] font-bold tabular-nums text-white">
          {pct}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "#1E2900" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: "#B1EB0B" }}
        />
      </div>
    </div>
  );
}

function useRoundNavDates(
  jogos: Jogo[],
  selectedRodada: number,
  hasPalpite: (matchId: number) => boolean,
) {
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

  const dateStatus = useCallback(
    (d: string): "done" | "partial" | "pending" => {
      const jd = jogosNaRodada.filter((j) => j.dataBR === d);
      const p = jd.filter((j) => hasPalpite(j.id)).length;
      if (p === 0) return "pending";
      if (p === jd.length) return "done";
      return "partial";
    },
    [jogosNaRodada, hasPalpite],
  );

  return { datas, dateStatus };
}

/** Faixa horizontal: Ontem · Hoje · Amanhã · datas (referência mobile). */
function PalpiteDateChipsStrip({
  datas,
  selectedDate,
  onDate,
  todayBR,
  dateStripRef,
}: {
  datas: string[];
  selectedDate: string | null;
  onDate: (d: string) => void;
  todayBR: string;
  dateStripRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (datas.length === 0) return null;

  return (
    <div
      ref={dateStripRef}
      className="flex w-full items-center gap-5 overflow-x-auto scroll-smooth px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {datas.map((d) => {
        const isSelected = selectedDate === d;
        const label = formatPalpiteDateChipLabel(d, todayBR);
        return (
          <button
            key={d}
            type="button"
            data-palpite-date={d}
            onClick={() => onDate(d)}
            className={`shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2.5 text-[18px] leading-none transition-colors active:scale-[0.98] ${isSelected
                ? "bg-zinc-800 font-bold text-white"
                : "bg-transparent font-semibold text-zinc-400 hover:text-zinc-300"
              }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Calendário + progresso — sticky imediatamente acima da lista de jogos. */
function BolaoRoundStickyDateProgress({
  jogos,
  selectedRodada,
  hasPalpite,
  selectedDate,
  onDate,
  todayBR,
}: {
  jogos: Jogo[];
  selectedRodada: number;
  hasPalpite: (matchId: number) => boolean;
  selectedDate: string | null;
  onDate: (d: string) => void;
  todayBR: string;
}) {
  const dateStripRef = useRef<HTMLDivElement>(null);
  const { datas } = useRoundNavDates(jogos, selectedRodada, hasPalpite);

  useEffect(() => {
    if (!selectedDate || !dateStripRef.current) return;
    const el = dateStripRef.current.querySelector(
      `[data-palpite-date="${selectedDate}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedDate, datas.join("|")]);

  return (
    <div
      className="sticky z-40 -mx-4 mb-3 flex w-[calc(100%+2rem)] flex-col gap-3 bg-black pb-1 pt-0.5"
      style={{ top: "var(--app-header-height, 55px)" }}
    >
      {datas.length > 0 ? (
        <div className="w-full bg-[#111111]">
          <PalpiteDateChipsStrip
            datas={datas}
            selectedDate={selectedDate}
            onDate={onDate}
            todayBR={todayBR}
            dateStripRef={dateStripRef}
          />
        </div>
      ) : null}
      <div className="bg-black px-4">
        <RoundProgressBar
          jogos={jogos}
          selectedRodada={selectedRodada}
          hasPalpite={hasPalpite}
        />
      </div>
    </div>
  );
}

// ── Round / Phase Navigation ──────────────────────────────────
function RoundPhaseNav({
  jogos,
  hasPalpite,
  selectedRodada,
  onRodada,
  selectedDate,
  onDate,
  roundTitle,
  showRoundNav = true,
  embedded = false,
  hideProgress = false,
  /** Só título/setas; data + progresso ficam em BolaoRoundStickyDateProgress. */
  headerOnly = false,
}: {
  jogos: Jogo[];
  predictionsMap: Record<number, { scoreCasa: number; scoreVisitante: number }>;
  hasPalpite: (matchId: number) => boolean;
  selectedRodada: number;
  onRodada: (r: number) => void;
  selectedDate: string | null;
  onDate: (d: string | null) => void;
  roundTitle: string;
  showRoundNav?: boolean;
  embedded?: boolean;
  hideProgress?: boolean;
  headerOnly?: boolean;
}) {
  const dateStripRef = useRef<HTMLDivElement>(null);
  const rodadas = useMemo(
    () => Array.from(new Set(jogos.map((j) => j.rodada))).sort((a, b) => a - b),
    [jogos],
  );
  const rodadaIdx = rodadas.indexOf(selectedRodada);
  const canPrev = rodadaIdx > 0;
  const canNext = rodadaIdx < rodadas.length - 1;

  const { datas } = useRoundNavDates(jogos, selectedRodada, hasPalpite);

  useEffect(() => {
    if (headerOnly || !selectedDate || !dateStripRef.current) return;
    const el = dateStripRef.current.querySelector(
      `[data-palpite-date="${selectedDate}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [headerOnly, selectedDate, datas.join("|")]);

  if (headerOnly) {
    if (!showRoundNav || rodadas.length <= 1) return null;
    return (
      <div className={`mb-2.5 ${embedded ? "" : "mb-5"}`}>
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
          <span className="px-2 text-center text-[15px] font-black text-white">
            {roundTitle}
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
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2.5 ${embedded ? "" : "mb-5"}`}
    >
      {showRoundNav && rodadas.length > 1 ? (
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
          <span className="px-2 text-center text-[15px] font-black text-white">
            {roundTitle}
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
      ) : roundTitle ? (
        null
      ) : null}

      <PalpiteDateChipsStrip
        datas={datas}
        selectedDate={selectedDate}
        onDate={(d) => onDate(d)}
        todayBR={todayBR()}
        dateStripRef={dateStripRef}
      />

      {!hideProgress ? (
        <RoundProgressBar
          jogos={jogos}
          selectedRodada={selectedRodada}
          hasPalpite={hasPalpite}
        />
      ) : null}
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
  const router = useRouter();
  const { requestModal } = useMainBolaoPromoModal();
  const showPalpitesDebug = searchParams.get("debugPalpites") === "1";
  const resultMode = searchParams.get("mode") === "resultado";
  const ticketId = searchParams.get("ticket");
  const hasBoloesFlow = Boolean(ticketId);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;
  const [bolaoType, setBolaoType] = useState<"principal" | "diario" | "extra">(
    initialData?.bolaoType ?? "principal",
  );
  const isGratisExtra = isGratisBolaoExtraTicket(
    bolaoType,
    initialData?.isPromoBonus,
  );
  const runWithPromoIfGratis = useCallback(
    (action: () => void) => {
      action();
      if (!isGratisExtra) return;
      requestModal();
    },
    [isGratisExtra, requestModal],
  );
  const openGratisRanking = useCallback(() => {
    if (!ticketId) return;
    const href = `/ranking?default=${encodeURIComponent(ticketId)}`;
    router.push(href);
    if (isGratisExtra) requestModal();
  }, [isGratisExtra, requestModal, router, ticketId]);
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
  const [rankingBoardRows, setRankingBoardRows] = useState<RankingBoardRow[]>(
    [],
  );
  const [rankingBoardMeta, setRankingBoardMeta] =
    useState<RankingBoardMeta | null>(null);
  const [rankingBoardLoading, setRankingBoardLoading] = useState(false);
  const [rankingBoardError, setRankingBoardError] = useState<string | null>(
    null,
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
  const [draftScores, setDraftScores] = useState<
    Record<number, JogoCardScores>
  >({});
  const draftDirtyRef = useRef<Set<number>>(new Set());
  const [draftTouchedIds, setDraftTouchedIds] = useState<Record<number, true>>(
    {},
  );
  const [palpitesEditing, setPalpitesEditing] = useState(false);
  const [savingAllPalpites, setSavingAllPalpites] = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);
  const [saveMatchErrors, setSaveMatchErrors] = useState<Record<number, string>>({});
  const [palpiteToast, setPalpiteToast] = useState<string | null>(null);
  const palpiteToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPalpiteToast = useCallback((msg: string) => {
    setPalpiteToast(msg);
    if (palpiteToastTimer.current) clearTimeout(palpiteToastTimer.current);
    palpiteToastTimer.current = setTimeout(() => setPalpiteToast(null), 2600);
  }, []);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [selectedRodada, setSelectedRodada] = useState<number | null>(() => {
    const bt = initialData?.bolaoType;
    const skaleFullPool = initialData?.isSkaleFullCopaPool === true;
    const ticketRoundFromServer =
      bt === "extra" &&
      !skaleFullPool &&
      initialData?.extraRoundNumber != null &&
      Number.isFinite(Number(initialData.extraRoundNumber)) &&
      Number(initialData.extraRoundNumber) > 0
        ? Number(initialData.extraRoundNumber)
        : null;
    if (ticketRoundFromServer != null) return ticketRoundFromServer;
    if (!initialData?.jogos?.length) return null;
    const lockIds =
      bt === "diario" || (bt === "extra" && !skaleFullPool)
        ? Object.keys(initialData.predictionsMap ?? {})
          .map(Number)
          .filter(Number.isFinite)
        : [];
    const extraId =
      bt === "extra" || skaleFullPool
        ? (() => {
          const r = initialData.extraChampionshipId;
          if (r != null && Number.isFinite(Number(r)) && Number(r) > 0) return Number(r);
          return getSoleConfiguredExtraChampionshipId();
        })()
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

  const resolvedExtraChampionshipId = useMemo(() => {
    if (bolaoType !== "extra") return null;
    const raw = initialData?.extraChampionshipId;
    if (raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) return Number(raw);
    return getSoleConfiguredExtraChampionshipId();
  }, [bolaoType, initialData?.extraChampionshipId]);

  const isSkaleFullCopaPool = initialData?.isSkaleFullCopaPool === true;
  const isSkaleDailyEditionPool = initialData?.isSkaleDailyEditionPool === true;
  const dailyEditionNumber = initialData?.dailyEditionNumber ?? null;
  const dailyEditionDateSet = useMemo(() => {
    const dates = initialData?.dailyEditionDates ?? [];
    return dates.length > 0 ? new Set(dates) : null;
  }, [initialData?.dailyEditionDates]);
  const dailyEditionDatesLabel = initialData?.dailyEditionDatesLabel ?? null;

  const showPredictionsSkeleton =
    Boolean(ticketId) &&
    loadingPredictions &&
    Object.keys(predictionsMap).length === 0;

  const bolaoTypeRef = useRef(bolaoType);
  bolaoTypeRef.current = bolaoType;
  const predictionsMapRef = useRef(predictionsMap);
  predictionsMapRef.current = predictionsMap;

  const ssrTicketHydrated =
    Boolean(initialData?.ticketId && initialData.ticketId === ticketId) &&
    Boolean(initialData?.jogos?.length);
  const initialPlacarSigRef = useRef(
    (initialData?.jogos ?? [])
      .map(
        (j) =>
          `${j.id}:${j.resultCasa ?? ""}:${j.resultVisitante ?? ""}:${j.status}`,
      )
      .sort()
      .join("|"),
  );

  useEffect(() => {
    if (initialData?.tabela && initialData.ticketId === ticketId) return;
    let cancelled = false;
    const compId =
      bolaoType === "extra" && resolvedExtraChampionshipId != null && resolvedExtraChampionshipId > 0
        ? resolvedExtraChampionshipId
        : getFootballMainCompetitionId();
    setLoadingTabela(true);
    fetch(`/api/tabela?competitionId=${encodeURIComponent(String(compId))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTabela(pickTabelaGruposForPalpites(data) as TabelaGrupos | null);
      })
      .catch(() => {
        if (!cancelled) setTabela(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTabela(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bolaoType, resolvedExtraChampionshipId, initialData?.tabela, initialData?.ticketId, ticketId]);

  /** Partidas: poll em background; pula tick imediato se SSR já trouxe jogos. */
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function applyRodadaInicial(parsed: Jogo[]) {
      const bt = bolaoTypeRef.current;
      // Ticket extra por rodada → seleciona a rodada do ticket.
      const ticketRound =
        bt === "extra" &&
          initialDataRef.current?.extraRoundNumber != null &&
          Number.isFinite(Number(initialDataRef.current.extraRoundNumber)) &&
          Number(initialDataRef.current.extraRoundNumber) > 0
          ? Number(initialDataRef.current.extraRoundNumber)
          : null;
      if (ticketRound != null) {
        const rodadasDispAll = Array.from(new Set(parsed.map((j) => j.rodada)));
        const fallback = rodadasDispAll[0] ?? 0;
        setSelectedRodada((prev) =>
          prev != null ? prev : rodadasDispAll.includes(ticketRound) ? ticketRound : fallback,
        );
        return;
      }
      const lockIds =
        bt === "diario" || bt === "extra"
          ? Object.keys(predictionsMapRef.current)
            .map(Number)
            .filter(Number.isFinite)
          : [];
      const extraId =
        bt === "extra"
          ? (() => {
            const r = initialDataRef.current?.extraChampionshipId;
            if (r != null && Number.isFinite(Number(r)) && Number(r) > 0) return Number(r);
            return getSoleConfiguredExtraChampionshipId();
          })()
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
        const id =
          bolaoTypeRef.current === "extra"
            ? (() => {
              const r = initialDataRef.current?.extraChampionshipId;
              if (r != null && Number.isFinite(Number(r)) && Number(r) > 0) return Number(r);
              return getSoleConfiguredExtraChampionshipId();
            })()
            : null;
        const partidasUrl =
          bolaoTypeRef.current === "extra" && id != null
            ? partidasUrlWithLiveSync("/api/partidas", { competitionId: id })
            : partidasUrlWithLiveSync("/api/partidas");
        const r = await fetch(partidasUrl, { cache: "no-store" });
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok) {
          setErro(true);
          return;
        }
        const fases = data?.partidas as Record<string, any> | undefined;
        let { jogos: parsed, grupos: letras } = parseAllPartidas(fases);
        const bt = bolaoTypeRef.current;
        const ticketRound =
          bt === "extra" &&
          initialDataRef.current?.extraRoundNumber != null &&
          Number.isFinite(Number(initialDataRef.current.extraRoundNumber)) &&
          Number(initialDataRef.current.extraRoundNumber) > 0
            ? Number(initialDataRef.current.extraRoundNumber)
            : null;
        if (ticketRound != null) {
          parsed = parsed.filter((j) => j.rodada === ticketRound);
        }
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
    intervalId = setInterval(tick, LIVE_PARTIDAS_POLL_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [ticketId]);

  useEffect(() => {
    if (resultMode) setTab("jogos");
  }, [resultMode]);

  useEffect(() => {
    if (!initialData?.ticketId || initialData.ticketId !== ticketId) return;
    setBolaoType(initialData.bolaoType);
    if (initialData.jogos?.length) {
      setJogos(initialData.jogos);
      setGrupos(initialData.grupos ?? []);
      setGrupo(initialData.grupo ?? "GERAL");
      setErro(false);
    }
    if (
      initialData.bolaoType === "extra" &&
      initialData.extraRoundNumber != null &&
      Number.isFinite(Number(initialData.extraRoundNumber)) &&
      Number(initialData.extraRoundNumber) > 0
    ) {
      setSelectedRodada(Number(initialData.extraRoundNumber));
    }
  }, [
    initialData?.ticketId,
    initialData?.bolaoType,
    initialData?.jogos,
    initialData?.grupos,
    initialData?.grupo,
    initialData?.extraRoundNumber,
    ticketId,
  ]);

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
    const extraId = bolaoType === "extra" ? resolvedExtraChampionshipId : null;
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
  }, [bolaoType, jogos, predictionsMap, resolvedExtraChampionshipId]);

  const jogosPlacarSignature = useMemo(
    () =>
      jogos
        .map(
          (j) =>
            `${j.id}:${j.resultCasa ?? ""}:${j.resultVisitante ?? ""}:${j.status}:${j.statusBruto ?? ""}:${j.liveMinuto ?? ""}`,
        )
        .sort()
        .join("|"),
    [jogos],
  );

  useEffect(() => {
    let cancelled = false;
    const isSsrHydration =
      ssrTicketHydrated &&
      jogosPlacarSignature === initialPlacarSigRef.current;
    const load = async () => {
      if (!isSsrHydration) setRankingBoardLoading(true);
      const result = await fetchRankingBoardClient(bolaoType, ticketId);
      if (cancelled) return;
      setRankingBoardRows(result.rows);
      setRankingBoardMeta(result.meta);
      setRankingBoardError(result.error);
      setRankingBoardLoading(false);
    };
    if (isSsrHydration) {
      let idleId: number | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (typeof requestIdleCallback === "function") {
        idleId = requestIdleCallback(() => void load());
      } else {
        timeoutId = setTimeout(() => void load(), 80);
      }
      return () => {
        cancelled = true;
        if (idleId != null && typeof cancelIdleCallback === "function") {
          cancelIdleCallback(idleId);
        }
        if (timeoutId != null) clearTimeout(timeoutId);
      };
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bolaoType, ticketId, jogosPlacarSignature, ssrTicketHydrated]);

  useEffect(() => {
    if (!ticketId) return;
    const isSsrHydration =
      ssrTicketHydrated &&
      jogosPlacarSignature === initialPlacarSigRef.current &&
      initialDataRef.current?.resumoStats != null;
    if (isSsrHydration) return;
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
  }, [ticketId, jogosPlacarSignature, ssrTicketHydrated]);

  useEffect(() => {
    draftDirtyRef.current = new Set();
    setDraftScores({});
    setDraftTouchedIds({});
    setSaveAllError(null);
    setPalpitesEditing(false);
  }, [ticketId]);

  useEffect(() => {
    setDraftScores((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [idStr, scores] of Object.entries(predictionsMap)) {
        const id = Number(idStr);
        if (!Number.isFinite(id)) continue;
        if (draftDirtyRef.current.has(id)) continue;
        const cur = next[id];
        if (
          cur?.scoreCasa === scores.scoreCasa &&
          cur?.scoreVisitante === scores.scoreVisitante
        ) {
          continue;
        }
        next[id] = scores;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [predictionsMap]);

  const scoresForMatch = (matchId: number): JogoCardScores =>
    draftScores[matchId] ?? predictionsMap[matchId] ?? EMPTY_JOGO_CARD_SCORES;

  const handleScoresChange = (matchId: number, scores: JogoCardScores) => {
    draftDirtyRef.current.add(matchId);
    setDraftTouchedIds((prev) =>
      prev[matchId] ? prev : { ...prev, [matchId]: true },
    );
    setDraftScores((prev) => ({ ...prev, [matchId]: scores }));
  };

  const hasPalpite = useCallback(
    (matchId: number) => {
      if (predictionsMap[matchId]) return true;
      const draft = draftScores[matchId];
      return draft != null && scoresAreComplete(draft);
    },
    [predictionsMap, draftScores],
  );

  const today = todayBR();
  const dailyLike =
    bolaoType === "diario" ||
    isSkaleDailyEditionPool ||
    (bolaoType === "extra" && !isSkaleFullCopaPool && !isSkaleDailyEditionPool);
  const extraPlayCompId = bolaoType === "extra" ? resolvedExtraChampionshipId : null;
  /**
   * Quando o ticket extra é "por rodada" (`tickets.round_number`), o bolão é
   * **a rodada inteira** — não filtramos por dia. Caso `null` (extras legados),
   * mantemos o comportamento "extra ≈ diário" (apenas o dia jogável).
   */
  const extraTicketRound =
    bolaoType === "extra" &&
      initialData?.extraRoundNumber != null &&
      Number.isFinite(Number(initialData.extraRoundNumber)) &&
      Number(initialData.extraRoundNumber) > 0
      ? Number(initialData.extraRoundNumber)
      : null;
  const extraRoundMode =
    bolaoType === "extra" &&
    !isSkaleFullCopaPool &&
    !isSkaleDailyEditionPool &&
    extraTicketRound != null;
  /** "Dia‐jogavel" só faz sentido em diario e em extras legados (sem rodada). */
  const dayScopedMode =
    bolaoType === "diario" ||
    isSkaleDailyEditionPool ||
    (bolaoType === "extra" && !extraRoundMode && !isSkaleFullCopaPool);

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
  // Em "extra por rodada", o escopo é toda a rodada (não o dia).
  const jogosOnPlayableDate = jogos.filter((j) => {
    if (bolaoType === "principal" || isSkaleFullCopaPool) return true;
    if (extraRoundMode) return j.rodada === extraTicketRound;
    if (!dayScopedMode) return true;
    if (bolaoType === "diario" && dailyEditionDateSet != null) {
      return j.dataBR != null && dailyEditionDateSet.has(j.dataBR);
    }
    if (isSkaleDailyEditionPool && dailyEditionDateSet != null) {
      return j.dataBR != null && dailyEditionDateSet.has(j.dataBR);
    }
    return j.dataBR === diarioPlayableDate;
  });
  const nowMs = Date.now();
  const diarioLockedMode =
    dailyLike &&
    !extraRoundMode &&
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
  const showJogadores = readOnlyMode
    ? resultTab === "jogadores"
    : tab === "jogadores";

  /** Inclui jogos encerrados para o usuário ver placar, pontuação e detalhes do palpite. */
  const jogosBase = jogosOnPlayableDate;

  const jogosDisplayBase = jogosBase;

  /** Dia/rodada visível nas abas (Ontem/Hoje/…) — o rodapé só reflete este escopo. */
  const jogosEscopoVisivel = useMemo(() => {
    if (!hasBoloesFlow) return jogosDisplayBase;
    const rodadaScope =
      extraRoundMode && extraTicketRound != null ? extraTicketRound : selectedRodada;
    return jogosDisplayBase.filter((j) => {
      if (rodadaScope != null && j.rodada !== rodadaScope) return false;
      if (selectedDate && j.dataBR !== selectedDate) return false;
      return true;
    });
  }, [
    hasBoloesFlow,
    jogosDisplayBase,
    selectedRodada,
    selectedDate,
    extraRoundMode,
    extraTicketRound,
  ]);

  const hasEditableMatches = jogosEscopoVisivel.some((j) =>
    isJogoEditavelParaPalpite(j, bolaoType),
  );
  const showPalpitesFooter =
    Boolean(ticketId) && showJogos && !readOnlyMode && hasEditableMatches;

  const rodadaAtualSalvar =
    selectedRodada ??
    Array.from(new Set(jogosDisplayBase.map((j) => j.rodada))).sort(
      (a, b) => a - b,
    )[0] ??
    0;
  const filterPalpitesByDay =
    Boolean(ticketId) &&
    showJogos &&
    Boolean(selectedDate) &&
    selectedRodada != null;

  const jogosEscopoSalvar = useMemo(() => {
    if (hasBoloesFlow) return jogosEscopoVisivel;
    return jogosDisplayBase;
  }, [hasBoloesFlow, jogosEscopoVisivel, jogosDisplayBase]);

  /** Palpites já salvos no dia/escopo visível (não no ticket inteiro). */
  const hasSavedPalpitesOnScope = useMemo(
    () => jogosEscopoSalvar.some((j) => Boolean(predictionsMap[j.id])),
    [jogosEscopoSalvar, predictionsMap],
  );

  useEffect(() => {
    if (palpitesEditing && !hasEditableMatches) setPalpitesEditing(false);
  }, [palpitesEditing, hasEditableMatches]);

  useEffect(() => {
    if (!hasSavedPalpitesOnScope && palpitesEditing) setPalpitesEditing(false);
  }, [hasSavedPalpitesOnScope, palpitesEditing]);

  useEffect(() => {
    setPalpitesEditing(false);
    setSaveAllError(null);
    draftDirtyRef.current.clear();
    setDraftTouchedIds({});
  }, [selectedDate, selectedRodada]);

  const cancelPalpitesEdit = () => {
    draftDirtyRef.current.clear();
    setDraftScores({ ...predictionsMap });
    setDraftTouchedIds({});
    setSaveAllError(null);
    setPalpitesEditing(false);
  };

  const matchNeedsSave = useCallback(
    (matchId: number, scores: JogoCardScores) => {
      if (!scoresAreComplete(scores)) return false;
      if (!draftDirtyRef.current.has(matchId) && !draftTouchedIds[matchId]) {
        return false;
      }
      const saved = predictionsMap[matchId];
      if (!saved) return true;
      return (
        scores.scoreCasa !== saved.scoreCasa ||
        scores.scoreVisitante !== saved.scoreVisitante
      );
    },
    [draftTouchedIds, predictionsMap],
  );

  const hasPalpitesToSave = useMemo(() => {
    const now = Date.now();
    return jogosEscopoSalvar.some((j) => {
      if (!isJogoEditavelParaPalpite(j, bolaoType, now)) return false;
      return matchNeedsSave(j.id, scoresForMatch(j.id));
    });
  }, [jogosEscopoSalvar, bolaoType, matchNeedsSave, draftScores, draftTouchedIds]);

  const saveAllPalpites = async () => {
    if (!ticketId || savingAllPalpites) return;
    setSaveAllError(null);
    const now = Date.now();
    const toSave = jogosEscopoSalvar.filter((j) => {
      if (!isJogoEditavelParaPalpite(j, bolaoType, now)) return false;
      return matchNeedsSave(j.id, scoresForMatch(j.id));
    });
    if (toSave.length === 0) {
      setSaveAllError("Nenhum palpite alterado para salvar.");
      return;
    }
    setSavingAllPalpites(true);
    try {
      const palpites = toSave.map((jogo) => {
        const scores = scoresForMatch(jogo.id);
        if (!scoresAreComplete(scores)) {
          throw new Error("Preencha os dois placares antes de salvar.");
        }
        return {
          matchId: jogo.id,
          scoreCasa: scores.scoreCasa,
          scoreVisitante: scores.scoreVisitante,
        };
      });
      const r = await fetch("/api/palpites/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, palpites }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Falha ao salvar palpites");
      }
      const data = (await r.json()) as {
        predictions: Array<{
          matchId: number;
          scoreCasa: number;
          scoreVisitante: number;
        }>;
      };
      let newPalpitesCount = 0;
      const predictionsAfter: Record<
        number,
        { scoreCasa: number; scoreVisitante: number }
      > = { ...predictionsMap };
      for (const p of data.predictions) {
        if (!predictionsMap[p.matchId]) newPalpitesCount += 1;
        predictionsAfter[p.matchId] = {
          scoreCasa: p.scoreCasa,
          scoreVisitante: p.scoreVisitante,
        };
      }
      setPredictionsMap(predictionsAfter);
      if (newPalpitesCount > 0) {
        setResumoStats((prev) => ({
          ...prev,
          palpites: prev.palpites + newPalpitesCount,
        }));
      }
      for (const jogo of toSave) {
        draftDirtyRef.current.delete(jogo.id);
      }
      setDraftTouchedIds((prev) => {
        const next = { ...prev };
        for (const jogo of toSave) delete next[jogo.id];
        return next;
      });
      setPalpitesEditing(false);
      showPalpiteToast(toSave.length > 1 ? "Palpites salvos!" : "Palpite salvo!");
      if (
        filterPalpitesByDay &&
        selectedDate &&
        isRoundDayComplete(
          jogosDisplayBase,
          rodadaAtualSalvar,
          selectedDate,
          predictionsAfter,
        )
      ) {
        const nextDate = pickNextDateInRound(
          jogosDisplayBase,
          rodadaAtualSalvar,
          selectedDate,
          predictionsAfter,
        );
        if (nextDate && nextDate !== selectedDate) {
          setSelectedDate(nextDate);
        }
      }
      if (
        isGratisExtra &&
        allJogosHavePalpite(jogosDisplayBase, predictionsAfter)
      ) {
        requestModal();
      }
    } catch (e) {
      setSaveAllError(
        e instanceof Error ? e.message : "Falha ao salvar palpites",
      );
    } finally {
      setSavingAllPalpites(false);
    }
  };

  const saveSinglePalpite = async (matchId: number) => {
    if (!ticketId || savingMatchId != null) return;
    const scores = scoresForMatch(matchId);
    setSaveMatchErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    if (!scoresAreComplete(scores)) {
      setSaveMatchErrors((prev) => ({
        ...prev,
        [matchId]: "Preencha os dois placares.",
      }));
      return;
    }
    setSavingMatchId(matchId);
    try {
      const r = await fetch("/api/palpites/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          palpites: [
            {
              matchId,
              scoreCasa: scores.scoreCasa,
              scoreVisitante: scores.scoreVisitante,
            },
          ],
        }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Falha ao salvar palpite");
      }
      const data = (await r.json()) as {
        predictions: Array<{
          matchId: number;
          scoreCasa: number;
          scoreVisitante: number;
        }>;
      };
      const isNew = !predictionsMap[matchId];
      const predictionsAfter: Record<
        number,
        { scoreCasa: number; scoreVisitante: number }
      > = { ...predictionsMap };
      for (const p of data.predictions) {
        predictionsAfter[p.matchId] = {
          scoreCasa: p.scoreCasa,
          scoreVisitante: p.scoreVisitante,
        };
      }
      setPredictionsMap(predictionsAfter);
      if (isNew) {
        setResumoStats((prev) => ({ ...prev, palpites: prev.palpites + 1 }));
      }
      draftDirtyRef.current.delete(matchId);
      setDraftTouchedIds((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      showPalpiteToast("Palpite salvo!");
    } catch (e) {
      setSaveMatchErrors((prev) => ({
        ...prev,
        [matchId]: e instanceof Error ? e.message : "Falha ao salvar palpite",
      }));
    } finally {
      setSavingMatchId(null);
    }
  };

  const buildJogoCardEditProps = (jogo: Jogo) => {
    const canEditMatch = isJogoEditavelParaPalpite(jogo, bolaoType);
    /** Palpite salvo continua visível E editável até o apito (não trava após salvar). */
    const canChangeOnCard = !readOnlyMode && canEditMatch && Boolean(ticketId);
    return {
      editingEnabled: canChangeOnCard,
      onScoresChange: canChangeOnCard
        ? (s: JogoCardScores) => handleScoresChange(jogo.id, s)
        : undefined,
      savingPalpite: savingMatchId === jogo.id,
      savePalpiteError: saveMatchErrors[jogo.id] ?? null,
    };
  };

  const palpitesFooterMode: PalpitesFooterMode = !hasSavedPalpitesOnScope
    ? "initial"
    : palpitesEditing
      ? "editing"
      : "edit-locked";

  const palpitesListFooter = showPalpitesFooter ? (
    <PalpitesListFooter
      mode={palpitesFooterMode}
      disabled={loadingPredictions}
      saveDisabled={!hasPalpitesToSave}
      loading={savingAllPalpites}
      error={saveAllError}
      onEdit={() => {
        setSaveAllError(null);
        setPalpitesEditing(true);
      }}
      onSave={() => void saveAllPalpites()}
      onCancel={cancelPalpitesEdit}
    />
  ) : null;

  const shouldFilterByGroup = !hasBoloesFlow && grupos.length > 0;
  const matchesGroup = (j: Jogo) =>
    shouldFilterByGroup ? j.grupo === grupo : true;

  const rodadasNoEscopo = useMemo(
    () =>
      Array.from(new Set(jogosDisplayBase.map((j) => j.rodada))).sort(
        (a, b) => a - b,
      ),
    [jogosDisplayBase],
  );

  const extraRoundLabel = (() => {
    const fromSnapshot = (initialData?.extraRoundName ?? "").trim();
    if (fromSnapshot) return fromSnapshot;
    if (extraTicketRound != null && Number.isFinite(extraTicketRound) && extraTicketRound > 0) {
      return `${extraTicketRound}ª Rodada`;
    }
    return null;
  })();

  const showBolaoRoundNav = hasBoloesFlow && showJogos;
  const showRoundNavControls =
    (bolaoType === "principal" || isSkaleFullCopaPool) && rodadasNoEscopo.length > 1;

  const roundNavTitle = (() => {
    if (bolaoType === "principal" || isSkaleFullCopaPool) {
      return `Fase de Grupos — ${selectedRodada ?? rodadasNoEscopo[0] ?? 1}`;
    }
    if (extraRoundMode) {
      return extraRoundLabel ?? `${extraTicketRound ?? selectedRodada ?? 1}ª Rodada`;
    }
    if (bolaoType === "diario") {
      if (dailyEditionNumber != null) {
        const d = selectedDate ?? diarioPlayableDate;
        const pill = d ? parseDatePill(d) : null;
        const editionHead = `Bolão Diário #${dailyEditionNumber}`;
        if (pill) return `${editionHead} · ${pill.dia} ${pill.mes}`;
        if (dailyEditionDatesLabel) return `${editionHead} · ${dailyEditionDatesLabel}`;
        return editionHead;
      }
      const d = selectedDate ?? diarioPlayableDate;
      const pill = d ? parseDatePill(d) : null;
      if (pill) return `Jogos do dia · ${pill.dia} ${pill.mes}`;
      return "Jogos do dia";
    }
    if (isSkaleDailyEditionPool && dailyEditionNumber != null) {
      const d = selectedDate ?? diarioPlayableDate;
      const pill = d ? parseDatePill(d) : null;
      const editionHead = `Bolão Diário Skale #${dailyEditionNumber}`;
      if (pill) return `${editionHead} · ${pill.dia} ${pill.mes}`;
      if (dailyEditionDatesLabel) return `${editionHead} · ${dailyEditionDatesLabel}`;
      return editionHead;
    }
    if (selectedRodada != null) return rodadaLabel(selectedRodada);
    return "Rodada";
  })();

  const jogosFiltradosNav = useMemo(() => {
    if (!hasBoloesFlow) return jogosDisplayBase.filter(matchesGroup);
    const rodadaScope =
      extraRoundMode && extraTicketRound != null ? extraTicketRound : selectedRodada;
    return jogosDisplayBase.filter((j) => {
      if (rodadaScope != null && j.rodada !== rodadaScope) return false;
      if (selectedDate && j.dataBR !== selectedDate) return false;
      return matchesGroup(j);
    });
  }, [
    hasBoloesFlow,
    jogosDisplayBase,
    selectedRodada,
    selectedDate,
    grupo,
    shouldFilterByGroup,
    extraRoundMode,
    extraTicketRound,
  ]);

  const rodadasDisponiveis = Array.from(
    new Set(
      (hasBoloesFlow ? jogosFiltradosNav : jogosDisplayBase.filter(matchesGroup)).map(
        (j) => j.rodada,
      ),
    ),
  ).sort((a, b) => a - b);
  const effectiveSelectedRodada =
    extraRoundMode && extraTicketRound != null
      ? extraTicketRound
      : (selectedRodada ?? rodadasDisponiveis[0] ?? 0);
  const jogosPorRodada = rodadasDisponiveis.map((idx) => {
    const source = hasBoloesFlow ? jogosFiltradosNav : jogosDisplayBase;
    const jogosDaRodada = source
      .filter((j) => matchesGroup(j) && j.rodada === idx)
      // Defesa em profundidade: ordena por kickoff (asc); o SSR já ordena, mas
      // se o jogo vier por outro caminho (HMR, fetch direto de /api/partidas)
      // garantimos cronologia aqui também.
      .sort((a, b) => {
        const ka = a.kickoffAt ? Date.parse(a.kickoffAt) : Number.POSITIVE_INFINITY;
        const kb = b.kickoffAt ? Date.parse(b.kickoffAt) : Number.POSITIVE_INFINITY;
        if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;
        return a.id - b.id;
      });
    // Para o bolão extra, o cabeçalho do bloco DEVE refletir a rodada real do
    // ticket (extraTicketRound / extraRoundName) — nunca um label inferido do
    // valor `idx` (que costuma ser igual, mas se houver dados legados duvidosos
    // não queremos confundir o usuário).
    const labelFromExtra =
      extraRoundMode && idx === extraTicketRound
        ? ((initialData?.extraRoundName ?? "").trim() ||
          (extraTicketRound != null ? `${extraTicketRound}ª Rodada` : null))
        : null;
    return {
      label: labelFromExtra ?? rodadaLabel(idx),
      jogos: jogosDaRodada,
    };
  });
  const showGroupedByGroup =
    hasBoloesFlow && (bolaoType === "principal" || isSkaleFullCopaPool);
  const debugInfo = {
    ticketId,
    bolaoType,
    resolvedExtraChampionshipId,
    calendarToday: today,
    totalJogos: jogos.length,
    diarioPlayableDate,
    jogosOnPlayableDateCount: jogosOnPlayableDate.length,
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

  const jogosSubtitle = !hasBoloesFlow
    ? "Fase de Grupos"
    : bolaoType === "principal" || isSkaleFullCopaPool
      ? "Jogos · Copa inteira"
      : extraRoundMode
        ? (extraRoundLabel ?? "Rodada atual")
        : bolaoType === "diario" && dailyEditionDatesLabel
          ? `Fase de grupos · ${dailyEditionDatesLabel}`
          : isSkaleDailyEditionPool && dailyEditionDatesLabel
            ? `Fase de grupos · ${dailyEditionDatesLabel}`
            : diarioPlayableDate === today
            ? "Jogos do dia atual"
            : `Jogos em ${diarioPlayableDate} (dia mais próximo com partidas)`;

  useEffect(() => {
    if (!showPalpitesDebug) return;
    console.info("[palpites/debug]", debugInfo);
  }, [
    showPalpitesDebug,
    ticketId,
    bolaoType,
    resolvedExtraChampionshipId,
    today,
    jogos.length,
    diarioPlayableDate,
    jogosOnPlayableDate.length,
    jogosBase.length,
    jogosDisplayBase.length,
    rodadasDisponiveis.join(","),
    selectedRodada,
    grupo,
    hasBoloesFlow,
    readOnlyMode,
    diarioLockedMode,
  ]);

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
    if (!showBolaoRoundNav) return;
    if (selectedRodada === null) return;
    const jogosNaRodadaAtual = jogosDisplayBase.filter(
      (j) => j.rodada === selectedRodada,
    );
    const datas = Array.from(new Set(jogosNaRodadaAtual.map((j) => j.dataBR)))
      .filter(Boolean)
      .sort((a, b) => (brDateToUtcMs(a) ?? 0) - (brDateToUtcMs(b) ?? 0));
    if (datas.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (datas.length === 1) {
      setSelectedDate(null);
      return;
    }
    // Mantém o dia selecionado se ainda válido; senão o primeiro pendente ou o primeiro dia
    if (selectedDate && datas.includes(selectedDate)) return;
    const nextPending = datas.find((d) =>
      jogosNaRodadaAtual
        .filter((j) => j.dataBR === d)
        .some((j) => !predictionsMap[j.id]),
    );
    setSelectedDate(nextPending ?? datas[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRodada, predictionsLoadedOnce, showBolaoRoundNav]);

  const gruposComJogos = Array.from(
    new Set(jogosDisplayBase.map((j) => j.grupo).filter(Boolean)),
  ).sort();
  const jogosFiltradosParaGrupos = showGroupedByGroup
    ? jogosFiltradosNav
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
  const myRankingPos =
    rankingBoardRows.find((row) => row.isMe)?.pos ?? null;
  const rankingLockBloco = palpiteLockUiCopy(bolaoType).rankingBloco;
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
    <div
      className="w-full max-w-lg mx-auto px-4 pb-8 lg:max-w-7xl"
    >
      {palpiteToast ? (
        <div
          className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8"
          role="status"
          aria-live="polite"
        >
          <div className="animate-tab-in flex items-center gap-2 rounded-full border border-primary/30 bg-[#0E1A0E] px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
            <CircleCheck className="size-5 text-primary" strokeWidth={2.4} aria-hidden />
            <span className="text-[14px] font-bold text-white">{palpiteToast}</span>
          </div>
        </div>
      ) : null}

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
          {hasBoloesFlow
            ? (initialData?.bolaoHeading?.trim() || "Palpites")
            : "Copa do Mundo 2026"}
        </h1>
        <p className="text-white/70 text-[17px] mt-1 font-bold">{jogosSubtitle}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
        {/* ── COLUNA ESQUERDA ─────────────────────────── */}
        <div>
          {/* Mobile: tabs */}
          <div className="mb-5 lg:hidden">
            {readOnlyMode ? (
              <PalpitesViewTabs
                items={[
                  { key: "jogos", label: "Jogos" },
                  { key: "ranking", label: "Ranking" },
                  { key: "jogadores", label: "Jogadores" },
                ]}
                value={resultTab}
                onChange={(next) => {
                  if (next === "ranking") {
                    runWithPromoIfGratis(() => setResultTab("ranking"));
                    return;
                  }
                  setResultTab(next);
                }}
              />
            ) : (
              <PalpitesViewTabs
                items={[
                  { key: "jogos", label: "Jogos" },
                  { key: "tabela", label: "Tabela" },
                  { key: "ranking", label: "Ranking" },
                  { key: "jogadores", label: "Jogadores" },
                ]}
                value={tab}
                onChange={(next) => {
                  if (next === "ranking") {
                    runWithPromoIfGratis(() => setTab("ranking"));
                    return;
                  }
                  setTab(next);
                }}
              />
            )}
          </div>

          {/* Mobile: filtro grupos (exceto ranking) */}
          {grupos.length > 1 &&
            tab !== "ranking" &&
            tab !== "resumo" &&
            tab !== "jogadores" &&
            !readOnlyMode &&
            !hasBoloesFlow && (
              <div className="mb-5 lg:hidden">
                <BotoesGrupo />
              </div>
            )}

          {/* Desktop: filtro de grupos */}
          {grupos.length > 1 && !readOnlyMode && !hasBoloesFlow && (
            <div className="hidden lg:block mb-6">
              <BotoesGrupo />
            </div>
          )}

          {showBolaoRoundNav ? (
            <BolaoRoundStickyDateProgress
              jogos={jogosDisplayBase}
              selectedRodada={effectiveSelectedRodada}
              hasPalpite={hasPalpite}
              selectedDate={selectedDate}
              onDate={setSelectedDate}
              todayBR={today}
            />
          ) : null}

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
                    {showPalpitesDebug ? (
                      <details className="mb-4 w-full max-w-md rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-[11px] text-white/70">
                        <summary className="cursor-pointer font-black uppercase text-primary">
                          Debug (?debugPalpites=1)
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap wrap-break-word text-[12px] leading-relaxed">
                          {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                    <Disc
                      className="w-10 h-10 mb-3 text-white/20"
                      strokeWidth={1.5}
                    />
                    <p className="text-white/30 text-sm">
                      {dailyLike && diarioLockedMode
                        ? "Nenhum palpite encontrado para este ticket"
                        : extraRoundMode
                          ? "Nenhuma partida nesta rodada do bolão"
                          : hasBoloesFlow
                            ? dailyLike
                              ? "Nenhuma partida para este bolão no momento. Use ?debugPalpites=1 para diagnóstico."
                              : "Nenhum jogo disponível hoje"
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

                          <RodadaSectionHeader label={label} groupKey={groupKey} />
                          {rJogos.map((jogo) => (
                            <JogoCard
                              key={jogo.id}
                              jogo={jogo}
                              readOnly={readOnlyMode}
                              scores={scoresForMatch(jogo.id)}
                              {...buildJogoCardEditProps(jogo)}
                              initialPrediction={
                                predictionsMap[jogo.id] ?? null
                              }
                              predictionsLoading={loadingPredictions}
                              bolaoType={bolaoType}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  jogosPorRodada.map(({ label, jogos: rJogos }) => (
                    <div key={label}>
                      <RodadaSectionHeader label={label} />
                      {rJogos.map((jogo) => (
                        <JogoCard
                          key={jogo.id}
                          jogo={jogo}
                          readOnly={readOnlyMode}
                          scores={scoresForMatch(jogo.id)}
                          {...buildJogoCardEditProps(jogo)}
                          initialPrediction={predictionsMap[jogo.id] ?? null}
                          predictionsLoading={loadingPredictions}
                          bolaoType={bolaoType}
                        />
                      ))}
                    </div>
                  ))
                )}
                {palpitesListFooter}
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
              <PalpitesRankingTab
                ticketId={ticketId}
                bolaoType={bolaoType}
                resumoStats={resumoStats}
                rows={rankingBoardRows}
                meta={rankingBoardMeta}
                loading={rankingBoardLoading}
                error={rankingBoardError}
                lockBloco={rankingLockBloco}
                onRankingLinkClick={
                  isGratisExtra ? openGratisRanking : undefined
                }
                liveRefreshKey={jogosPlacarSignature}
              />
            ) : null}
            {showResumo ? (
              <TicketResumoView
                ticketId={ticketId}
                resultMode={resultMode}
                bolaoType={bolaoType}
                isSkaleFullCopaPool={isSkaleFullCopaPool}
                stats={resumoStats}
                rankingPos={myRankingPos}
                historico={historicoRows}
                loadingHistorico={loadingResumo}
                jogosById={jogosById}
              />
            ) : null}
            {showJogadores ? (
              <PalpitesJogadoresTab ticketId={ticketId} bolaoType={bolaoType} />
            ) : null}
          </div>

          {/* Desktop: grid 2 colunas de cards por rodada */}
          <div className="hidden lg:block">
            {readOnlyMode && (
              <PalpitesViewTabs
                className="mb-5 w-full max-w-md"
                items={[
                  { key: "jogos", label: "Jogos" },
                  { key: "ranking", label: "Ranking" },
                  { key: "resumo", label: "Resumo" },
                  { key: "jogadores", label: "Jogadores" },
                ]}
                value={resultTab}
                onChange={(next) => {
                  if (next === "ranking") {
                    runWithPromoIfGratis(() => setResultTab("ranking"));
                    return;
                  }
                  setResultTab(next);
                }}
              />
            )}

            {showResumo ? (
              <TicketResumoView
                ticketId={ticketId}
                resultMode={resultMode}
                bolaoType={bolaoType}
                isSkaleFullCopaPool={isSkaleFullCopaPool}
                stats={resumoStats}
                rankingPos={myRankingPos}
                historico={historicoRows}
                loadingHistorico={loadingResumo}
                jogosById={jogosById}
              />
            ) : showJogadores ? (
              <PalpitesJogadoresTab ticketId={ticketId} bolaoType={bolaoType} />
            ) : showRanking ? (
              <PalpitesRankingTab
                ticketId={ticketId}
                bolaoType={bolaoType}
                resumoStats={resumoStats}
                rows={rankingBoardRows}
                meta={rankingBoardMeta}
                loading={rankingBoardLoading}
                error={rankingBoardError}
                lockBloco={rankingLockBloco}
                onRankingLinkClick={
                  isGratisExtra ? openGratisRanking : undefined
                }
                liveRefreshKey={jogosPlacarSignature}
              />
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
                {showPalpitesDebug ? (
                  <details className="mb-4 w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-[11px] text-white/70">
                    <summary className="cursor-pointer font-black uppercase text-primary">
                      Debug (?debugPalpites=1)
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap wrap-break-word text-[12px] leading-relaxed">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </details>
                ) : null}
                <Disc
                  className="w-10 h-10 mb-3 text-white/20"
                  strokeWidth={1.5}
                />
                <p className="text-white/30 text-sm">
                  {dailyLike && diarioLockedMode
                    ? "Nenhum palpite encontrado para este ticket"
                    : extraRoundMode
                      ? "Nenhuma partida nesta rodada do bolão"
                      : hasBoloesFlow
                        ? dailyLike
                          ? "Nenhuma partida para este bolão no momento. Use ?debugPalpites=1 para diagnóstico."
                          : "Nenhum jogo disponível hoje"
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
                            scores={scoresForMatch(jogo.id)}
                            {...buildJogoCardEditProps(jogo)}
                            initialPrediction={predictionsMap[jogo.id] ?? null}
                            predictionsLoading={loadingPredictions}
                            bolaoType={bolaoType}
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
                        scores={scoresForMatch(jogo.id)}
                        {...buildJogoCardEditProps(jogo)}
                        initialPrediction={predictionsMap[jogo.id] ?? null}
                        predictionsLoading={loadingPredictions}
                        bolaoType={bolaoType}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
            {showPalpitesFooter ? (
              <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border border-white/10 bg-black/85 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm [&>div]:mt-0">
                {palpitesListFooter}
              </div>
            ) : null}
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
              rankingBoardRows={rankingBoardRows}
              rankingBoardLoading={rankingBoardLoading}
              ticketId={ticketId}
              stats={resumoStats}
              bolaoType={bolaoType}
              onRankingLinkClick={
                isGratisExtra ? openGratisRanking : undefined
              }
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
      <div className="mb-5 pointer-events-none lg:hidden">
        <PalpitesViewTabs
          items={[
            { key: "jogos", label: "Jogos" },
            { key: "tabela", label: "Tabela" },
            { key: "ranking", label: "Ranking" },
          ]}
          value="jogos"
          onChange={() => { }}
        />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
