"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronDown, Disc, Star, Target, Trophy, Users } from "lucide-react";
import { TrophyGold, TrophySilver, TrophyBronze } from "@/app/components/RankingTrophies";
import bgPixel from "@/app/assets/bg-hero-pixels.png";
import bollIcon from "@/app/assets/boll.svg";

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
  palpites: 48,
  acertos: 26,
  pontos: 112,
  exatos: 6,
};

function initials(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "BM";
}

function RankingMedal({ pos, size = 28 }: { pos: number; size?: number }) {
  if (pos === 1) return <TrophyGold size={size} />;
  if (pos === 2) return <TrophySilver size={size} />;
  if (pos === 3) return <TrophyBronze size={size} />;
  return <span className="text-[11px] font-bold text-white/30">#{pos}</span>;
}

function RankingAvatar({ label, isMe, size = 34 }: { label: string; isMe?: boolean; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: isMe ? "rgba(177,235,11,0.14)" : "rgba(255,255,255,0.07)",
        color: isMe ? "#B1EB0B" : "rgba(255,255,255,0.66)",
        border: isMe ? "1px solid rgba(177,235,11,0.36)" : "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {initials(label)}
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
    (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (pool === "principal") q.set("bolaoType", "principal");
        if (pool === "diario") q.set("bolaoType", "diario");
        const [rankingResp, resumoResp] = await Promise.all([
          fetch(`/api/palpites/ranking?${q.toString()}`, { credentials: "include", cache: "no-store" }),
          fetch("/api/palpites/resumo", { credentials: "include", cache: "no-store" }),
        ]);
        const rankingData = (await rankingResp.json().catch(() => ({}))) as { ranking?: RankingRow[] };
        const resumoData = (await resumoResp.json().catch(() => ({}))) as { resumo?: ResumoStats };
        if (cancelled) return;
        if (rankingResp.ok && Array.isArray(rankingData.ranking) && rankingData.ranking.length > 0) {
          setRankingRows(rankingData.ranking);
        } else {
          setRankingRows(MOCK_RANKING_ROWS);
        }
        if (resumoResp.ok && resumoData.resumo && resumoData.resumo.palpites > 0) {
          setStats(resumoData.resumo);
        } else {
          setStats(MOCK_STATS);
        }
      } catch {
        if (!cancelled) {
          setRankingRows(MOCK_RANKING_ROWS);
          setStats(MOCK_STATS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pool]);

  const me = rankingRows.find((r) => r.isMe) ?? rankingRows[0] ?? null;
  const podium = useMemo(() => [rankingRows[1], rankingRows[0], rankingRows[2]].filter(Boolean) as RankingRow[], [rankingRows]);
  const tableRows = rankingRows.length > 3 ? rankingRows.slice(3, 10) : rankingRows;
  const poolLabel = pool === "principal" ? "Copa do Mundo 2026" : pool === "diario" ? "Bolão Diário" : me?.ticketId ?? "Minha cota";

  return (
    <main className="font-helvetica-now-display relative min-h-screen overflow-hidden bg-black pb-24 text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]"
        style={{
          backgroundImage: `url(${bgPixel.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-[260px] z-0 h-40"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0), #000 72%, #000 100%)" }}
      />
      <div className="pointer-events-none fixed right-[-120px] top-16 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(177,235,11,0.11)" }} />
      <div className="pointer-events-none fixed left-[-150px] top-[360px] h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(20,184,166,0.08)" }} />

      <div className="relative z-1 mx-auto max-w-lg px-4 pt-7">
        <section className="relative overflow-hidden rounded-[28px] border border-[#171B1A] bg-[#050605]/72 px-5 pb-5 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-primary/12 blur-2xl" />
          <div className="relative z-1 flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/28 bg-black/45 px-3 py-1.5">
                <Trophy className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Ranking oficial</span>
              </div>
              <h1 className="text-[40px] font-black leading-[0.94] tracking-[-0.04em]">
                <span className="block text-white">Top</span>
                <span className="block text-primary">Palpiteiros</span>
              </h1>
              <p className="mt-3 max-w-[250px] text-[14px] font-light leading-snug text-white/86">
                Acompanhe sua cota, veja os melhores palpites e dispute o topo da Copa 2026.
              </p>
            </div>
            <img src={bollIcon.src} alt="" className="mt-4 h-16 w-16 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(177,235,11,0.35)]" />
          </div>
          <div className="relative z-1 mt-5 grid grid-cols-3 gap-2">
            {[
              { label: "Cotas", value: Math.max(rankingRows.length, 1) },
              { label: "Top 10", value: "ao vivo" },
              { label: "Prêmio", value: "R$1M" },
            ].map((item) => (
              <div key={item.label} className="rounded-[14px] border border-white/8 bg-black/35 px-2.5 py-2 text-center">
                <p className="text-[13px] font-black leading-none text-primary">{item.value}</p>
                <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-white/50">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative z-20 mt-5 grid grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPoolOpen((v) => !v)}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-[18px] px-4 text-left active:scale-[0.99]"
              style={{ background: "#101010", border: "2px solid #171B1A", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-black/50">
                  <Disc className="h-4 w-4 text-primary" strokeWidth={2.4} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-white">{poolLabel}</span>
                  <span className="block text-[10px] font-medium text-white/45">Selecionar bolão/cota</span>
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition-transform ${poolOpen ? "rotate-180" : ""}`} />
            </button>
            {poolOpen ? (
              <div className="absolute left-0 right-0 top-[62px] z-30 overflow-hidden rounded-[18px]" style={{ background: "#101010", border: "2px solid #171B1A", boxShadow: "0 18px 40px rgba(0,0,0,0.55)" }}>
                {[
                  { key: "principal" as const, label: "Copa do Mundo 2026", meta: "Ranking geral por cota" },
                  { key: "diario" as const, label: "Bolão Diário", meta: "Ranking do bolão diário" },
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
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      style={{ background: active ? "rgba(177,235,11,0.09)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-white">{option.label}</span>
                        <span className="block truncate text-[11px] text-white/38">{option.meta}</span>
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.8} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="flex h-14 min-w-[92px] flex-col items-center justify-center rounded-[18px]" style={{ background: "#101010", border: "2px solid #171B1A" }}>
            <span className="flex items-center gap-1 text-[14px] font-black text-primary">
              <Users className="h-4 w-4" strokeWidth={2.6} />
              {loading ? "--" : Math.max(rankingRows.length, 1)}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/36">cotas</span>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 overflow-hidden rounded-[22px]" style={{ background: "#101010", border: "2px solid #171B1A", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          {[
            { Icon: Disc, val: stats.palpites, label: "Palpites", sub: "", color: "#B1EB0B" },
            { Icon: Target, val: stats.acertos, label: "Acertos", sub: stats.palpites ? `(${Math.round((stats.acertos / Math.max(stats.palpites, 1)) * 100)}%)` : "(0%)", color: "#B1EB0B" },
            { Icon: Star, val: stats.pontos, label: "Pontos", sub: "", color: "#D7FF59" },
          ].map(({ Icon, val, label, sub, color }, idx) => (
            <div key={label} className="relative flex flex-col items-center gap-1 py-4" style={{ borderRight: idx < 2 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <Icon className="mb-1 h-5 w-5" style={{ color }} strokeWidth={2.2} />
              <span className="text-[11px] text-white/48">{label}</span>
              <span className="text-[24px] font-black leading-none text-primary">
                {loading ? "--" : val}
                {sub ? <span className="ml-1 text-[11px] font-semibold text-white/45">{sub}</span> : null}
              </span>
            </div>
          ))}
        </section>

        {podium.length > 0 ? (
          <section className="mt-7">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary">Pódio</p>
                <h2 className="mt-1 text-[26px] font-black leading-none text-white">Melhores cotas</h2>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-primary">ao vivo</span>
            </div>
            <div className="grid grid-cols-3 items-end gap-2">
            {podium.map((r) => {
              const isWinner = r.pos === 1;
              return (
                <div key={`podium-${r.pos}`} className={`relative flex flex-col items-center rounded-[22px] px-2 pb-4 pt-5 ${isWinner ? "min-h-[190px]" : "min-h-[160px]"}`} style={{ background: isWinner ? "linear-gradient(180deg, rgba(177,235,11,0.12), #101010 58%)" : "#101010", border: isWinner ? "2px solid rgba(177,235,11,0.54)" : "2px solid #171B1A", boxShadow: isWinner ? "0 0 28px rgba(177,235,11,0.16), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                  <div className="absolute -top-5"><RankingMedal pos={r.pos} size={isWinner ? 44 : 36} /></div>
                  <div className="mt-4"><RankingAvatar label={r.ticketId} isMe={r.isMe} size={isWinner ? 54 : 46} /></div>
                  <p className="mt-3 max-w-full truncate font-mono text-[13px] font-bold text-white">{r.ticketId}</p>
                  <p className="mt-2 text-[11px] text-white/46">Acertos</p>
                  <p className="text-[20px] font-black leading-none text-primary">{r.outcomeCount}</p>
                  <div className="my-3 h-px w-full bg-white/8" />
                  <p className="text-[11px] text-white/46">Pontos</p>
                  <p className="text-[19px] font-black leading-none text-primary">{r.totalPoints}</p>
                </div>
              );
            })}
            </div>
          </section>
        ) : (
          <div className="mt-6 rounded-[18px] border border-white/8 px-4 py-8 text-center text-sm text-white/45">Ranking ainda sem dados.</div>
        )}

        <section className="mt-5 overflow-hidden rounded-[22px]" style={{ background: "#101010", border: "2px solid #171B1A", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          <div className="grid grid-cols-[42px_1fr_70px_64px] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/40" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span>#</span>
            <span>Cota</span>
            <span className="text-right">Acertos</span>
            <span className="text-right">Pontos</span>
          </div>
          {tableRows.map((r, i) => (
            <div key={`rank-row-${r.pos}`} className="relative grid grid-cols-[42px_1fr_70px_64px] items-center px-4 py-3" style={{ background: r.isMe ? "linear-gradient(90deg, rgba(177,235,11,0.20), rgba(177,235,11,0.03))" : "transparent", borderBottom: i < tableRows.length - 1 ? "1px solid rgba(255,255,255,0.045)" : "none", boxShadow: r.isMe ? "inset 0 0 0 1px rgba(177,235,11,0.25), 0 0 18px rgba(177,235,11,0.12)" : "none" }}>
              {r.isMe ? <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-md bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase text-[#0E141B]">Você</span> : null}
              <span className="pl-1 text-[14px] font-black text-white/80">{r.pos}</span>
              <div className="flex min-w-0 items-center gap-2">
                <RankingAvatar label={r.ticketId} isMe={r.isMe} size={30} />
                <span className="truncate font-mono text-[12px] font-semibold text-white">{r.ticketId}</span>
              </div>
              <span className="text-right text-[13px] font-bold text-white/80">{r.outcomeCount}</span>
              <span className="text-right text-[14px] font-black text-primary">{r.totalPoints}</span>
            </div>
          ))}
        </section>

        <section className="mt-3 flex items-center justify-center gap-2 rounded-[18px] px-4 py-3" style={{ background: "#101010", border: "2px solid #171B1A" }}>
          <Bell className="h-4 w-4 text-primary" strokeWidth={2.2} />
          <span className="text-[12px] font-medium text-white/70">Palpites fecham <b className="text-primary">1h</b> antes de cada partida</span>
        </section>
      </div>
    </main>
  );
}
