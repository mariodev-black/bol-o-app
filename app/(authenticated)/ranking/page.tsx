"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Share2,
  Star,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { TrophyGold, TrophySilver, TrophyBronze } from "@/app/components/RankingTrophies";
import bannerRanking from "@/app/assets/banner-ranking.png";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";

type RankingScopeOption = {
  key: string;
  mode: "principal" | "diario";
  ticketId: string | null;
  label: string;
  meta: string;
  unusedPalpites: boolean;
  palpitesHref: string;
};

type BoardRow = {
  pos: number;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  isMe?: boolean;
};

type BoardMeta = {
  participantCount: number;
  revenueCents: number;
  poolCentsApprox: number;
  nextPalpiteLockMs: number | null;
  approxPremiados: number;
  /** Quando false e todos com 0 pts, UI mostra “aguardando pontuação”. */
  hasResultedMatchesInPool?: boolean;
};

type ResumoStats = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

const PRIMARY = "#B1EB0B";
const CARD = "#101010";
const BORDER = "rgba(255,255,255,0.08)";

function formatParticipantsShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 1000) return `${Math.round(n / 1000)} mil`;
  return String(Math.round(n));
}

function formatPoolBRL(cents: number): string {
  const v = Math.max(0, Math.round(cents));
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v / 100);
}

function formatClosingCountdown(lockMs: number | null): string {
  if (lockMs == null) return "Em breve";
  const d = lockMs - Date.now();
  if (d <= 0) return "Fechado";
  const totalM = Math.ceil(d / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function PlayerAvatar({
  userId,
  displayName,
  isMe,
  avatarIndex,
  avatarUploadFilename,
  sizeClass,
}: {
  userId: string;
  displayName: string;
  isMe?: boolean;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  sizeClass: string;
}) {
  const custom = avatarUploadFilename;
  const ring = isMe ? "ring-2 ring-primary/50" : "ring-1 ring-white/15";

  if (custom) {
    const src = `/api/public/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(custom)}`;
    return (
      <div className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}>
        <Image src={src} alt="" fill className="object-cover" sizes="96px" unoptimized />
      </div>
    );
  }

  const preset = getAvatarPresetImage(avatarIndex);
  return (
    <div className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}>
      <Image src={preset} alt="" fill className="object-cover" sizes="96px" />
    </div>
  );
}

function StatMarqueeItem({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 border-r border-white/8 px-1 py-2 last:border-r-0">
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
      <p className="text-center text-[9px] font-black uppercase leading-tight tracking-wide text-primary">{title}</p>
      <p className="text-center text-[8px] font-semibold uppercase leading-snug text-white/55">{subtitle}</p>
    </div>
  );
}

function PodiumMedal({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) return <TrophyGold size={32} label="1" />;
  if (rank === 2) return <TrophySilver size={28} />;
  return <TrophyBronze size={28} />;
}

function PodiumCard({
  row,
  rank,
  elevated,
}: {
  row: BoardRow;
  rank: 1 | 2 | 3;
  elevated: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-stretch ${elevated ? "w-[34%] max-w-[132px] -translate-y-1" : "w-[30%] max-w-[118px]"}`}
    >
      <div
        className="flex flex-col items-center rounded-2xl px-1 pb-3 pt-2.5"
        style={{
          background: CARD,
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: elevated ? "rgba(177,235,11,0.65)" : BORDER,
          boxShadow: elevated ? "0 0 28px rgba(177,235,11,0.28), inset 0 1px 0 rgba(255,255,255,0.06)" : "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mb-2 flex h-9 items-center justify-center">
          <PodiumMedal rank={rank} />
        </div>
        <PlayerAvatar
          userId={row.userId}
          displayName={row.displayName}
          isMe={Boolean(row.isMe)}
          avatarIndex={row.avatarIndex}
          avatarUploadFilename={row.avatarUploadFilename}
          sizeClass={elevated ? "size-[4.25rem]" : "size-14"}
        />
        <div className="mt-2 flex max-w-full items-center justify-center gap-0.5 px-0.5">
          <span className="truncate text-center text-[11px] font-black text-white">{row.displayName}</span>
          <Check className="size-3 shrink-0 text-primary" strokeWidth={3} aria-hidden />
        </div>
        <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-white/48">{row.outcomeCount} acertos</p>
        <p className="mt-0.5 text-center font-black leading-none text-primary" style={{ fontSize: elevated ? "1.35rem" : "1.1rem" }}>
          {row.totalPoints} pontos
        </p>
      </div>
    </div>
  );
}

const CACHE_MS = 45 * 1000;
const boardCache = new Map<string, { at: number; payload: { rows: BoardRow[]; meta: BoardMeta } }>();

export default function RankingPage() {
  const [scopes, setScopes] = useState<RankingScopeOption[]>([]);
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const [rankingRows, setRankingRows] = useState<BoardRow[]>([]);
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [stats, setStats] = useState<ResumoStats>({ palpites: 0, acertos: 0, pontos: 0, exatos: 0 });
  const [loadingScopes, setLoadingScopes] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingScopes(true);
      setError(null);
      try {
        const r = await fetch("/api/ranking/bootstrap", { credentials: "include", cache: "no-store" });
        const d = (await r.json()) as {
          scopes?: RankingScopeOption[];
          defaultKey?: string | null;
          hasAnyTicket?: boolean;
          initialBoard?: { scopeKey: string; rows: BoardRow[]; meta: BoardMeta } | null;
          initialResumo?: ResumoStats | null;
          error?: string;
        };
        if (cancelled) return;
        const list = Array.isArray(d.scopes) ? d.scopes : [];
        if (list.length === 0) {
          setScopes([]);
          setScopeKey(null);
          return;
        }
        setScopes(list);
        const def =
          d.defaultKey && list.some((s) => s.key === d.defaultKey) ? d.defaultKey : list[0]!.key;
        setScopeKey(def);
        if (d.initialBoard && d.initialBoard.scopeKey === def && Array.isArray(d.initialBoard.rows)) {
          const payload = { rows: d.initialBoard.rows, meta: d.initialBoard.meta ?? emptyMeta() };
          boardCache.set(def, { at: Date.now(), payload });
          setRankingRows(payload.rows);
          setMeta(d.initialBoard.meta ?? null);
        }
        if (d.initialResumo) {
          setStats(d.initialResumo);
        }
      } catch {
        if (!cancelled) {
          setScopes([]);
          setScopeKey(null);
        }
      } finally {
        if (!cancelled) setLoadingScopes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScope = useMemo(
    () => (scopeKey ? scopes.find((s) => s.key === scopeKey) ?? null : null),
    [scopes, scopeKey]
  );

  const firstDailyIndex = useMemo(() => scopes.findIndex((s) => s.mode === "diario"), [scopes]);

  const loadBoard = useCallback(async () => {
    if (!scopeKey || scopes.length === 0) return;
    const opt = scopes.find((s) => s.key === scopeKey);
    if (!opt) return;
    const cacheKey = scopeKey;
    const cached = boardCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setRankingRows(cached.payload.rows);
      setMeta(cached.payload.meta);
      return;
    }

    setLoadingBoard(true);
    setError(null);
    try {
      const boardUrl =
        opt.mode === "principal"
          ? "/api/ranking/board?mode=principal"
          : `/api/ranking/board?mode=diario&ticketId=${encodeURIComponent(opt.ticketId ?? "")}`;

      const resumoQ = new URLSearchParams();
      if (opt.mode === "principal") resumoQ.set("bolaoType", "principal");
      if (opt.mode === "diario" && opt.ticketId) {
        resumoQ.set("bolaoType", "diario");
        resumoQ.set("ticketId", opt.ticketId);
      }

      const [boardResp, resumoResp] = await Promise.all([
        fetch(boardUrl, { credentials: "include", cache: "no-store" }),
        fetch(`/api/palpites/resumo?${resumoQ.toString()}`, { credentials: "include", cache: "no-store" }),
      ]);

      const boardData = (await boardResp.json().catch(() => ({}))) as {
        rows?: BoardRow[];
        meta?: BoardMeta;
        error?: string;
      };
      const resumoData = (await resumoResp.json().catch(() => ({}))) as { resumo?: ResumoStats };

      if (!boardResp.ok) {
        setError(typeof boardData.error === "string" ? boardData.error : "Não foi possível carregar o ranking.");
        setRankingRows([]);
        setMeta(null);
        return;
      }

      const rows = Array.isArray(boardData.rows) ? boardData.rows : [];
      const m = boardData.meta ?? null;
      setRankingRows(rows);
      setMeta(m);
      boardCache.set(cacheKey, { at: Date.now(), payload: { rows, meta: m ?? emptyMeta() } });

      if (resumoResp.ok && resumoData.resumo) {
        setStats(resumoData.resumo);
      }
    } catch {
      setError("Erro de rede ao carregar o ranking.");
      setRankingRows([]);
      setMeta(null);
    } finally {
      setLoadingBoard(false);
    }
  }, [scopeKey, scopes]);

  useEffect(() => {
    if (loadingScopes || !scopeKey || scopes.length === 0) return;
    void loadBoard();
  }, [loadingScopes, scopeKey, scopes, loadBoard]);

  const topThree = useMemo(() => rankingRows.slice(0, 3), [rankingRows]);
  const rowsFourToTen = useMemo(() => rankingRows.slice(3, 10), [rankingRows]);

  const padTopThree = useMemo(() => [topThree[0] ?? null, topThree[1] ?? null, topThree[2] ?? null] as const, [topThree]);

  const myRows = useMemo(() => rankingRows.filter((r) => r.isMe), [rankingRows]);

  const myRow = useMemo(() => {
    if (myRows.length === 0) return null;
    const tid = selectedScope?.ticketId ?? null;
    if (tid) {
      const exact = myRows.find((r) => r.ticketId === tid);
      if (exact) return exact;
    }
    return myRows.reduce((a, b) => (a.pos <= b.pos ? a : b));
  }, [myRows, selectedScope?.ticketId]);

  const poolLabel = selectedScope?.label ?? "—";
  const poolMeta = selectedScope?.meta ?? "";
  const palpitesQuickHref = selectedScope?.palpitesHref ?? "/palpites";

  const shareRanking = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bolão do Milhão — Ranking", text: "Confira a classificação.", url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const statParticipants = meta ? formatParticipantsShort(meta.participantCount) : "—";
  const statPool = meta ? formatPoolBRL(meta.poolCentsApprox) : "—";
  const statClose = useMemo(() => formatClosingCountdown(meta?.nextPalpiteLockMs ?? null), [meta?.nextPalpiteLockMs, tick]);
  const statPremiados = meta ? String(meta.approxPremiados) : "—";

  const unusedCopy =
    selectedScope?.mode === "principal"
      ? "Suas cotas do bolão geral ainda têm jogos em aberto sem palpite. Quanto antes você enviar, mais chances de pontuar no ranking."
      : "Esta cota do bolão do dia ainda tem jogos disponíveis para palpite. Envie agora e entre na disputa pelos prêmios.";

  /** Há fila no bolão, mas ainda não há placar oficial nas partidas do pool — não mostrar pódio zerado. */
  const awaitingRankingScores = useMemo(() => {
    if (loadingBoard || rankingRows.length === 0) return false;
    const everyoneZero = rankingRows.every((r) => r.totalPoints === 0 && r.outcomeCount === 0);
    if (!everyoneZero) return false;
    return meta?.hasResultedMatchesInPool !== true;
  }, [loadingBoard, rankingRows, meta?.hasResultedMatchesInPool]);

  return (
    <main className="font-helvetica-now-display min-h-screen bg-black pb-28 text-white">
      <div className="mx-auto w-full max-w-[430px] px-3.5 pt-1">
        <section className="relative mt-1 overflow-hidden rounded-2xl border border-white/9 bg-[#0a0a0a] px-4 pb-5 pt-4">
          <div className="pointer-events-none absolute -right-6 top-6 h-28 w-28 opacity-[0.14] blur-3xl" style={{ background: PRIMARY }} />
          <div className="relative flex gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-primary" strokeWidth={2.4} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Ranking oficial</span>
              </div>
              <h1 className="mt-2 font-black uppercase leading-[0.95] tracking-tight">
                <span className="block text-[1.65rem] text-white sm:text-[1.85rem]">Classificação</span>
                <span className="block text-[1.65rem] sm:text-[1.85rem]" style={{ color: PRIMARY }}>
                  total
                </span>
              </h1>
              <p className="mt-2 max-w-66 text-[12px] font-medium leading-snug text-white/52">
                Ranking de <strong className="text-white/75">todos que apostaram</strong> neste bolão (uma linha por cota).
                Acompanhe posição, acertos e pontos.
              </p>
            </div>
            <div className="relative mt-1 h-[100px] w-[108px] shrink-0">
              <Image src={bannerRanking} alt="" fill className="object-contain object-right" sizes="120px" priority />
            </div>
          </div>
        </section>

        {loadingScopes ? (
          <p className="mt-6 text-center text-[12px] font-medium text-white/80">Carregando seus bolões…</p>
        ) : null}

        {!loadingScopes && scopes.length === 0 ? (
          <section
            className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-10 text-center"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <Ticket className="size-7 text-primary" strokeWidth={2} />
            </div>
            <h2 className="mt-4 text-[15px] font-black uppercase tracking-wide text-white">Nenhuma cota ativa</h2>
            <p className="mt-2 max-w-[17rem] text-[13px] font-medium leading-relaxed text-white/55">
              Você ainda não possui bolão geral ou bolão do dia pago. Adquira uma cota para aparecer aqui, acompanhar seu
              desempenho e subir no ranking.
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
              <Link
                href="/boloes"
                className="inline-flex h-11 items-center justify-center rounded-xl text-[11px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
                style={{ background: PRIMARY }}
              >
                Ver bolões e cotas
              </Link>
              <Link
                href="/tickets"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/14 text-[11px] font-black uppercase tracking-wide text-white/85 transition hover:bg-white/6"
              >
                Minhas compras
              </Link>
            </div>
          </section>
        ) : null}

        {!loadingScopes && scopes.length > 0 ? (
          <>
        <section className="relative z-20 mt-3">
          <button
            type="button"
            disabled={!scopeKey}
            onClick={() => setPoolOpen((v) => !v)}
            className="flex h-[3.35rem] w-full items-center justify-between gap-3 rounded-2xl border px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.99] disabled:opacity-60"
            style={{ background: CARD, borderColor: BORDER }}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border text-[18px] leading-none"
                style={{ borderColor: "rgba(177,235,11,0.28)", background: "rgba(177,235,11,0.08)" }}
                aria-hidden
              >
                ⚽
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Selecionar bolão / cota</span>
                <span className="mt-0.5 block truncate text-[13px] font-black text-white">{poolLabel}</span>
                {poolMeta ? <span className="mt-0.5 block truncate text-[12px] font-medium text-white/38">{poolMeta}</span> : null}
              </span>
            </span>
            <ChevronDown className={`size-4 shrink-0 text-primary transition-transform ${poolOpen ? "rotate-180" : ""}`} strokeWidth={2.6} />
          </button>

          {poolOpen ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[min(60vh,320px)] overflow-y-auto rounded-2xl border shadow-[0_18px_40px_rgba(0,0,0,0.65)]"
              style={{ background: CARD, borderColor: BORDER }}
            >
              {scopes.map((option, idx) => {
                const active = scopeKey === option.key;
                const showBolaoGeralHeader = idx === 0 && scopes[0]?.mode === "principal";
                const showBolaoDiaHeader = firstDailyIndex !== -1 && idx === firstDailyIndex;
                return (
                  <Fragment key={option.key}>
                    {showBolaoGeralHeader ? (
                      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#161616] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/80">
                        Bolão geral
                      </div>
                    ) : null}
                    {showBolaoDiaHeader ? (
                      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#161616] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/80">
                        Bolão do dia
                      </div>
                    ) : null}
                    <button
                    type="button"
                    onClick={() => {
                      setScopeKey(option.key);
                      setPoolOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/6 px-4 py-3 text-left last:border-b-0"
                    style={{ background: active ? "rgba(177,235,11,0.09)" : "transparent" }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-white">{option.label}</span>
                      <span className="block truncate text-[11px] text-white/38">{option.meta}</span>
                    </span>
                    {active ? <Check className="size-4 shrink-0 text-primary" strokeWidth={2.8} /> : null}
                  </button>
                  </Fragment>
                );
              })}
            </div>
          ) : null}
        </section>

        {selectedScope?.unusedPalpites ? (
          <section
            className="mt-4 overflow-hidden rounded-2xl border px-3.5 py-3.5"
            style={{ borderColor: "rgba(177,235,11,0.32)", background: "rgba(177,235,11,0.07)" }}
          >
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/12">
                <Ticket className="size-5 text-primary" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-wide text-primary">Ainda dá tempo de palpitar</p>
                <p className="mt-1 text-[12px] font-medium leading-snug text-white/72">{unusedCopy}</p>
                <Link
                  href={selectedScope.palpitesHref}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
                  style={{ background: PRIMARY }}
                >
                  Ir para palpites desta cota
                  <ChevronRight className="size-4" strokeWidth={2.8} />
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-3 grid grid-cols-4 overflow-hidden rounded-2xl border" style={{ background: CARD, borderColor: BORDER }}>
          <StatMarqueeItem icon={Users} title={`+${statParticipants}`} subtitle="Participantes" />
          <StatMarqueeItem icon={Trophy} title={statPool === "—" ? "—" : statPool} subtitle="Em prêmios (est.)" />
          <StatMarqueeItem icon={CalendarClock} title={`Fecham em ${statClose}`} subtitle="Palpites" />
          <StatMarqueeItem icon={Star} title="1 em cada 10" subtitle={`~${statPremiados} premiados`} />
        </section>

        {error ? <p className="mt-3 text-center text-[12px] font-semibold text-red-400">{error}</p> : null}

        {loadingBoard && rankingRows.length === 0 ? (
          <p className="mt-6 text-center text-[12px] font-medium text-white/80">Carregando ranking…</p>
        ) : null}

        {!loadingBoard && rankingRows.length === 0 ? (
          <p className="mt-6 text-center text-[12px] font-medium text-white/80">
            Ainda não há participantes com pontuação neste bolão.
          </p>
        ) : null}

        {awaitingRankingScores ? (
          <section
            className="mt-8 flex flex-col items-center rounded-2xl border border-dashed px-5 py-12 text-center"
            style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <CalendarClock className="size-7 text-primary" strokeWidth={2} />
            </div>
            <h2 className="mt-4 text-[15px] font-black uppercase tracking-wide text-white">Aguardando pontuação</h2>
            <p className="mt-2 max-w-[18rem] text-[13px] font-medium leading-relaxed text-white/55">
              Os palpites já entram na disputa, mas o ranking só ganha números quando houver jogos com resultado oficial.
              Volte em breve — a classificação atualiza automaticamente.
            </p>
          </section>
        ) : null}

        {!awaitingRankingScores && rankingRows.length > 0 ? (
          <section className="mt-5 flex items-end justify-center gap-2 px-0.5">
            {padTopThree[1] ? <PodiumCard row={padTopThree[1]} rank={2} elevated={false} /> : <div className="w-[30%]" />}
            {padTopThree[0] ? <PodiumCard row={padTopThree[0]} rank={1} elevated /> : <div className="w-[34%]" />}
            {padTopThree[2] ? <PodiumCard row={padTopThree[2]} rank={3} elevated={false} /> : <div className="w-[30%]" />}
          </section>
        ) : null}

        {!awaitingRankingScores && rankingRows.length > 0 ? (
          <section className="mt-6">
            <div className="overflow-hidden rounded-2xl border" style={{ background: CARD, borderColor: BORDER }}>
              <div className="grid grid-cols-[40px_minmax(0,1fr)_64px_56px] gap-1 border-b border-white/7 px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/38">
                <span>#</span>
                <span>Jogador</span>
                <span className="text-right">Acertos</span>
                <span className="text-right">Pontos</span>
              </div>

              {rowsFourToTen.map((row) => {
                const isMe = Boolean(row.isMe);
                return (
                  <div
                    key={`${row.pos}-${row.ticketId}`}
                    className="relative grid grid-cols-[40px_minmax(0,1fr)_64px_56px] items-center gap-1 border-b border-white/4 px-3 py-2.5 last:border-b-0"
                    style={{
                      background: isMe ? "linear-gradient(90deg, rgba(177,235,11,0.14), rgba(177,235,11,0.03))" : "transparent",
                      boxShadow: isMe ? "inset 0 0 0 1px rgba(177,235,11,0.22)" : undefined,
                    }}
                  >
                    {isMe ? (
                      <span
                        className="absolute left-2 top-1/2 z-1 -translate-y-1/2 rounded px-1 py-0.5 text-[7px] font-black uppercase text-[#0E141B]"
                        style={{ background: PRIMARY }}
                      >
                        Você
                      </span>
                    ) : null}
                    <span className={`text-[13px] font-black tabular-nums text-white/75 ${isMe ? "pl-10" : ""}`}>{row.pos}</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar
                        userId={row.userId}
                        displayName={row.displayName}
                        isMe={isMe}
                        avatarIndex={row.avatarIndex}
                        avatarUploadFilename={row.avatarUploadFilename}
                        sizeClass="size-8"
                      />
                      <span className="truncate text-[12px] font-black text-white">{row.displayName}</span>
                      <Check className="size-3 shrink-0 text-primary" strokeWidth={3} aria-hidden />
                    </div>
                    <span className="text-right text-[12px] font-bold tabular-nums text-white/78">{row.outcomeCount}</span>
                    <span className="text-right text-[13px] font-black tabular-nums text-primary">{row.totalPoints}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {myRow != null && myRow.pos > 10 && !awaitingRankingScores ? (
          <section className="mt-3">
            <div
              className="relative grid grid-cols-[40px_minmax(0,1fr)_64px_56px] items-center gap-1 overflow-hidden rounded-2xl border px-3 py-3"
              style={{
                background: "linear-gradient(90deg, rgba(177,235,11,0.18), rgba(177,235,11,0.05))",
                borderColor: "rgba(177,235,11,0.35)",
                boxShadow: "0 0 24px rgba(177,235,11,0.12)",
              }}
            >
              <span
                className="absolute left-2 top-1/2 z-1 -translate-y-1/2 rounded px-1 py-0.5 text-[7px] font-black uppercase text-[#0E141B]"
                style={{ background: PRIMARY }}
              >
                Você
              </span>
              <span className="pl-10 text-[13px] font-black tabular-nums text-white">{myRow.pos}</span>
              <div className="flex min-w-0 items-center gap-2">
                <PlayerAvatar
                  userId={myRow.userId}
                  displayName={myRow.displayName}
                  isMe
                  avatarIndex={myRow.avatarIndex}
                  avatarUploadFilename={myRow.avatarUploadFilename}
                  sizeClass="size-8"
                />
                <span className="truncate text-[12px] font-black text-white">{myRow.displayName}</span>
                <Check className="size-3 shrink-0 text-primary" strokeWidth={3} aria-hidden />
              </div>
              <span className="text-right text-[12px] font-bold tabular-nums text-white/85">{myRow.outcomeCount}</span>
              <span className="text-right text-[14px] font-black tabular-nums text-primary">{myRow.totalPoints}</span>
            </div>
          </section>
        ) : null}

        <section className="mt-5">
          <div className="flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3.5" style={{ background: CARD, borderColor: BORDER }}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <Trophy className="size-5 text-primary" strokeWidth={2.2} />
            </div>
            <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-snug tracking-wide text-white/65">
              Faça seus palpites e suba no ranking! Cada palpite te aproxima do prêmio.
            </p>
            <Link
              href={palpitesQuickHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2.5 text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
              style={{ background: PRIMARY }}
            >
              Palpitar agora
              <ChevronRight className="size-4" strokeWidth={2.8} />
            </Link>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={palpitesQuickHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-black uppercase tracking-wide text-white/90 transition hover:bg-white/4"
            style={{ borderColor: "rgba(177,235,11,0.35)", background: "rgba(177,235,11,0.04)" }}
          >
            <Pencil className="size-3.5 text-primary" strokeWidth={2.3} />
            Palpites
          </Link>
          <button
            type="button"
            onClick={() => void shareRanking()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/3 text-[12px] font-black uppercase tracking-wide text-white/88 transition hover:bg-white/6"
          >
            <Share2 className="size-3.5 text-primary" strokeWidth={2.3} />
            Compartilhar
          </button>
        </section>

        <section className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border" style={{ background: CARD, borderColor: BORDER }}>
          <div className="border-r border-white/8 py-3 text-center">
            <p className="text-[9px] font-black uppercase text-white/80">Palpites (você)</p>
            <p className="mt-1 text-xl font-black text-primary">{loadingBoard ? "—" : stats.palpites}</p>
          </div>
          <div className="border-r border-white/8 py-3 text-center">
            <p className="text-[9px] font-black uppercase text-white/80">Acertos</p>
            <p className="mt-1 text-xl font-black text-primary">{loadingBoard ? "—" : stats.acertos}</p>
          </div>
          <div className="py-3 text-center">
            <p className="text-[9px] font-black uppercase text-white/80">Pontos</p>
            <p className="mt-1 text-xl font-black text-primary">{loadingBoard ? "—" : stats.pontos}</p>
          </div>
        </section>
        </>
        ) : null}
      </div>
    </main>
  );
}

function emptyMeta(): BoardMeta {
  return {
    participantCount: 0,
    revenueCents: 0,
    poolCentsApprox: 0,
    nextPalpiteLockMs: null,
    approxPremiados: 0,
    hasResultedMatchesInPool: false,
  };
}
