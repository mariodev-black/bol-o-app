"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Disc,
  Globe2,
  Medal,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { TrophyGold, TrophySilver, TrophyBronze } from "@/app/components/RankingTrophies";
import bannerRanking from "@/app/assets/banner-ranking.png";

type RankingRow = {
  pos: number;
  ticketId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  isMe?: boolean;
};

type ResumoStats = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

type PoolKey = "principal" | "diario" | "minha-cota";

const GREEN = "#B1EB0B";
const GREEN_SOFT = "#0AC96B";
const CARD = "#101010";
const BORDER = "rgba(255,255,255,0.08)";

const MOCK_RANKING_ROWS: RankingRow[] = [
  { pos: 1, ticketId: "BM-7K2D", totalPoints: 146, exactCount: 12, outcomeCount: 31, goalsCount: 38 },
  { pos: 2, ticketId: "BM-3H8G", totalPoints: 132, exactCount: 10, outcomeCount: 28, goalsCount: 34 },
  { pos: 3, ticketId: "BM-9Q4M", totalPoints: 119, exactCount: 9, outcomeCount: 27, goalsCount: 29 },
  { pos: 4, ticketId: "BM-K2L7", totalPoints: 108, exactCount: 8, outcomeCount: 24, goalsCount: 28 },
  { pos: 5, ticketId: "BM-L9P1", totalPoints: 103, exactCount: 7, outcomeCount: 23, goalsCount: 27 },
  { pos: 6, ticketId: "BM-D5F6", totalPoints: 99, exactCount: 6, outcomeCount: 22, goalsCount: 25 },
  { pos: 7, ticketId: "BM-A1X9", totalPoints: 97, exactCount: 6, outcomeCount: 21, goalsCount: 25, isMe: true },
  { pos: 8, ticketId: "BM-R8Y3", totalPoints: 91, exactCount: 5, outcomeCount: 20, goalsCount: 23 },
  { pos: 9, ticketId: "BM-Z4B0", totalPoints: 87, exactCount: 5, outcomeCount: 19, goalsCount: 22 },
  { pos: 10, ticketId: "BM-W7N6", totalPoints: 82, exactCount: 4, outcomeCount: 18, goalsCount: 20 },
];

const MOCK_STATS: ResumoStats = {
  palpites: 14,
  acertos: 0,
  pontos: 0,
  exatos: 0,
};

function initials(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "BM";
}

function percent(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function shortTicket(ticketId: string): string {
  const clean = ticketId.trim();
  if (!clean) return "BM------";
  if (clean.startsWith("BM-")) return clean;
  return `BM-${clean.slice(0, 4).toUpperCase()}`;
}

function RankingMedal({ pos }: { pos: number }) {
  if (pos === 1) return <TrophyGold size={24} />;
  if (pos === 2) return <TrophySilver size={24} />;
  if (pos === 3) return <TrophyBronze size={24} />;
  return <span className="text-[12px] font-black tabular-nums text-white/72">{pos}</span>;
}

function RankingAvatar({ label, isMe }: { label: string; isMe?: boolean }) {
  return (
    <div
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
      style={{
        background: isMe ? "rgba(177,235,11,0.16)" : "rgba(255,255,255,0.07)",
        color: isMe ? GREEN : "rgba(255,255,255,0.72)",
        border: isMe ? "1px solid rgba(177,235,11,0.42)" : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {initials(label)}
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center border-r border-white/8 py-3 last:border-r-0">
      <Icon className="mb-1 size-4 text-primary" strokeWidth={2.1} />
      <p className="text-[10px] font-semibold leading-none text-white/45">{label}</p>
      <p className="mt-1 text-[24px] font-black leading-none text-primary">
        {value}
        {sub ? <span className="ml-1 text-[10px] font-semibold text-white/45">{sub}</span> : null}
      </p>
    </div>
  );
}

export default function RankingPage() {
  const [pool, setPool] = useState<PoolKey>("principal");
  const [poolOpen, setPoolOpen] = useState(false);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>(MOCK_RANKING_ROWS);
  const [stats, setStats] = useState<ResumoStats>(MOCK_STATS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRanking() {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (pool === "principal") q.set("bolaoType", "principal");
        if (pool === "diario") q.set("bolaoType", "diario");

        const [rankingResp, resumoResp] = await Promise.all([
          fetch(`/api/palpites/ranking?${q.toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/palpites/resumo", {
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        const rankingData = (await rankingResp.json().catch(() => ({}))) as { ranking?: RankingRow[] };
        const resumoData = (await resumoResp.json().catch(() => ({}))) as { resumo?: ResumoStats };

        if (cancelled) return;
        setRankingRows(
          rankingResp.ok && Array.isArray(rankingData.ranking) && rankingData.ranking.length > 0
            ? rankingData.ranking
            : MOCK_RANKING_ROWS,
        );
        setStats(
          resumoResp.ok && resumoData.resumo && resumoData.resumo.palpites > 0
            ? resumoData.resumo
            : MOCK_STATS,
        );
      } catch {
        if (!cancelled) {
          setRankingRows(MOCK_RANKING_ROWS);
          setStats(MOCK_STATS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRanking();
    return () => {
      cancelled = true;
    };
  }, [pool]);

  const me = rankingRows.find((r) => r.isMe) ?? rankingRows[6] ?? rankingRows[0] ?? null;
  const topTen = useMemo(() => rankingRows.slice(0, 10), [rankingRows]);
  const poolLabel =
    pool === "principal" ? "Copa do Mundo 2026" : pool === "diario" ? "Bolão do Dia" : me?.ticketId ?? "Minha cota";
  const mePosition = me?.pos == null ? "--" : `${me.pos}º`;
  const cotasCount = loading ? "--" : Math.max(rankingRows.length, 1);

  return (
    <main className="font-helvetica-now-display min-h-screen overflow-hidden bg-black pb-24 text-white">
      <div className="mx-auto w-full max-w-[430px] px-3.5">
        <section className="overflow-hidden rounded-[16px] border border-white/10 bg-[#080808] shadow-[0_18px_38px_rgba(0,0,0,0.5)]">
          <Image
            src={bannerRanking}
            alt="Ranking oficial Top Palpiteiros"
            className="h-auto w-full object-cover"
            priority
            sizes="(max-width: 430px) 100vw, 430px"
          />
        </section>

        <section className="relative z-20 mt-3 grid grid-cols-[minmax(0,1fr)_92px] gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPoolOpen((v) => !v)}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-[#111] px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-primary/35 bg-primary/10">
                  <Globe2 className="size-4 text-primary" strokeWidth={2.3} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-white">{poolLabel}</span>
                  <span className="block text-[10px] font-medium text-white/45">Selecionar bolão/cota</span>
                </span>
              </span>
              <ChevronDown className={`size-4 shrink-0 text-primary transition-transform ${poolOpen ? "rotate-180" : ""}`} />
            </button>

            {poolOpen && (
              <div className="absolute left-0 right-0 top-[62px] z-30 overflow-hidden rounded-[14px] border border-white/10 bg-[#111] shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
                {[
                  { key: "principal" as const, label: "Copa do Mundo 2026", meta: "Ranking geral por cota" },
                  { key: "diario" as const, label: "Bolão do Dia", meta: "Ranking diário" },
                  { key: "minha-cota" as const, label: me?.ticketId ?? "Minha cota", meta: "Acompanhar minha cota" },
                ].map((option) => {
                  const active = pool === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setPool(option.key);
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
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex h-14 flex-col items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10">
            <span className="flex items-center gap-1 text-[14px] font-black text-primary">
              <Users className="size-4" strokeWidth={2.6} />
              {cotasCount}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/44">cotas</span>
          </div>
        </section>

        <section className="mt-2 grid grid-cols-3 overflow-hidden rounded-[14px] border border-white/10 bg-[#111]">
          <StatBox icon={Disc} label="Palpites" value={loading ? "--" : stats.palpites} />
          <StatBox
            icon={Target}
            label="Acertos"
            value={loading ? "--" : stats.acertos}
            sub={loading ? "" : `(${percent(stats.acertos, stats.palpites)})`}
          />
          <StatBox icon={Star} label="Pontos" value={loading ? "--" : stats.pontos} />
        </section>

        {me && (
          <section className="mt-3 grid grid-cols-[minmax(0,1fr)_1px_80px_76px] items-center overflow-hidden rounded-[14px] border border-primary/30 bg-primary/10 px-3 py-3 shadow-[0_0_24px_rgba(177,235,11,0.12)]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-black/35">
                <Users className="size-6 text-primary" strokeWidth={2.1} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-wide text-white/55">Sua posição</p>
                <p className="text-[24px] font-black leading-none text-primary">{mePosition}</p>
              </div>
            </div>
            <span className="h-11 bg-primary/20" aria-hidden />
            <div className="text-center">
              <p className="text-[21px] font-black leading-none text-primary">{me.outcomeCount}</p>
              <p className="mt-1 text-[9px] font-black uppercase leading-none text-white/58">Acertos</p>
            </div>
            <div className="text-center">
              <p className="text-[21px] font-black leading-none text-primary">{me.totalPoints}</p>
              <p className="mt-1 text-[9px] font-black uppercase leading-none text-white/58">Pontos</p>
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" strokeWidth={2.1} />
              <h2 className="text-[13px] font-black uppercase tracking-wide text-white">Classificação total</h2>
            </div>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-primary">
              Ao vivo
            </span>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-white/10 bg-[#111] shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
            <div className="grid grid-cols-[44px_minmax(0,1fr)_68px_64px] border-b border-white/8 px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/40">
              <span>#</span>
              <span>Jogador</span>
              <span className="text-right">Acertos</span>
              <span className="text-right">Pontos</span>
            </div>

            {topTen.map((row, index) => {
              const isMe = Boolean(row.isMe);
              const topThree = row.pos <= 3;
              return (
                <div
                  key={`ranking-${row.pos}-${row.ticketId}`}
                  className="relative grid grid-cols-[44px_minmax(0,1fr)_68px_64px] items-center border-b border-white/[0.045] px-3 py-2.5 last:border-b-0"
                  style={{
                    background: isMe
                      ? "linear-gradient(90deg, rgba(177,235,11,0.22), rgba(177,235,11,0.04))"
                      : topThree
                        ? "linear-gradient(90deg, rgba(234,179,8,0.12), rgba(255,255,255,0.01))"
                        : "transparent",
                    boxShadow: isMe ? "inset 0 0 0 1px rgba(177,235,11,0.25)" : "none",
                  }}
                >
                  {isMe && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 rounded-md bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase text-[#0E141B]">
                      Você
                    </span>
                  )}
                  <div className={isMe ? "pl-9" : ""}>
                    {topThree ? <RankingMedal pos={row.pos} /> : <span className="text-[13px] font-black text-white/76">{row.pos}</span>}
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <RankingAvatar label={row.ticketId} isMe={isMe} />
                    <span className="truncate font-mono text-[12px] font-black text-white">{shortTicket(row.ticketId)}</span>
                  </div>
                  <span className="text-right text-[13px] font-bold text-white/82">{row.outcomeCount}</span>
                  <span className="text-right text-[14px] font-black text-primary">{row.totalPoints}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-3 flex items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-[#111] px-4 py-3">
          <Bell className="size-4 text-primary" strokeWidth={2.2} />
          <span className="text-[12px] font-medium text-white/70">
            Palpites fecham <b className="text-primary">1h</b> antes de cada partida
          </span>
        </section>

        <section className="mt-3 flex items-center justify-center gap-2 rounded-[14px] border border-primary/20 bg-primary/[0.07] px-4 py-3">
          <Medal className="size-4 text-primary" strokeWidth={2.2} />
          <span className="text-[11px] font-semibold leading-snug text-white/72">
            Quanto mais palpites certeiros, maior sua chance de ficar no topo.
          </span>
        </section>
      </div>
    </main>
  );
}
