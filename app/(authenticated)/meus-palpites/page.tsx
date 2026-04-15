"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck, Clock3, Target, TriangleAlert, XCircle } from "lucide-react";

const C = {
  card: "#0A0E19",
  cardSoft: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",
  gold: "#D4AF37",
  goldLight: "#FFE8BA",
} as const;

type Pick = {
  id: number;
  badge: string;
  hit: boolean;
  points: string;
  home: string;
  away: string;
  guess: string;
  result: string;
  time: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
};

const STATS = [
  { label: "Exatos", value: 3, tone: C.gold, icon: Target, soft: "rgba(212,175,55,0.12)" },
  { label: "Certos", value: 6, tone: "#34D399", icon: CircleCheck, soft: "rgba(52,211,153,0.12)" },
  { label: "Errados", value: 3, tone: "#FB7185", icon: XCircle, soft: "rgba(251,113,133,0.12)" },
  { label: "Pendentes", value: 4, tone: "#94A3B8", icon: Clock3, soft: "rgba(148,163,184,0.12)" },
];

const FILTERS = [
  { label: "Todos", count: 16, active: true },
  { label: "Exatos", count: 3 },
  { label: "Certos", count: 6 },
  { label: "Errados", count: 3 },
];

const PICKS: Pick[] = [
  { id: 1, badge: "Vencedor certo", hit: true, points: "+1 pt", home: "QAT", away: "ECU", guess: "1-2", result: "0-2", time: "20/11 · 19:00", homeName: "Catar", awayName: "Equador", homeFlag: "🇶🇦", awayFlag: "🇪🇨" },
  { id: 2, badge: "Placar exato", hit: true, points: "+3 pts", home: "SEN", away: "NED", guess: "0-2", result: "0-2", time: "21/11 · 13:00", homeName: "Senegal", awayName: "Holanda", homeFlag: "🇸🇳", awayFlag: "🇳🇱" },
  { id: 3, badge: "Vencedor certo", hit: true, points: "+1 pt", home: "ENG", away: "IRN", guess: "2-0", result: "3-2", time: "21/11 · 16:00", homeName: "Inglaterra", awayName: "Irã", homeFlag: "🏴", awayFlag: "🇮🇷" },
  { id: 4, badge: "Errado", hit: false, points: "0 pts", home: "USA", away: "WAL", guess: "1-0", result: "1-1", time: "21/11 · 22:00", homeName: "EUA", awayName: "País de Gales", homeFlag: "🇺🇸", awayFlag: "🏴" },
  { id: 5, badge: "Errado", hit: false, points: "0 pts", home: "ARG", away: "KSA", guess: "3-0", result: "1-2", time: "22/11 · 15:00", homeName: "Argentina", awayName: "Arábia Saudita", homeFlag: "🇦🇷", awayFlag: "🇸🇦" },
  { id: 6, badge: "Vencedor certo", hit: true, points: "+1 pt", home: "FRA", away: "AUS", guess: "3-1", result: "4-1", time: "22/11 · 22:00", homeName: "França", awayName: "Austrália", homeFlag: "🇫🇷", awayFlag: "🇦🇺" },
];

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="w-[3px] h-[18px] rounded-full" style={{ background: C.gold }} />
        <h2 className="text-[17px] font-black text-white">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function HeroGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]" aria-hidden>
      <div
        className="absolute"
        style={{
          top: "-30%",
          right: "-25%",
          width: "95%",
          height: "85%",
          background:
            "radial-gradient(ellipse 75% 68% at 84% 10%, rgba(255,232,186,0.30) 0%, rgba(255,232,186,0.09) 44%, transparent 72%)",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-36%",
          left: "-30%",
          width: "92%",
          height: "78%",
          background:
            "radial-gradient(ellipse 72% 60% at 12% 90%, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.08) 42%, transparent 72%)",
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  soft,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ElementType;
  soft: string;
}) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: C.border, background: C.cardSoft }}>
      <div className="flex items-center justify-between">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center border" style={{ color: tone, background: soft, borderColor: soft }}>
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-[26px] leading-none font-black" style={{ color: tone }}>
          {value}
        </p>
      </div>
      <p className="text-[10px] mt-1.5 uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
    </div>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  return (
    <article
      className="rounded-2xl border p-3.5 relative overflow-hidden"
      style={{
        borderColor: "rgba(255,255,255,0.09)",
        background: "linear-gradient(180deg, rgba(11,16,29,0.97) 0%, rgba(8,12,22,0.97) 100%)",
      }}
    >
      <span
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: pick.hit ? "rgba(34,197,94,0.62)" : "rgba(239,68,68,0.62)" }}
        aria-hidden
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-[0.08em]"
          style={{
            color: pick.hit ? "#34D399" : "#F87171",
            background: pick.hit ? "rgba(34,197,94,0.10)" : "rgba(127,29,29,0.20)",
            border: pick.hit ? "1px solid rgba(34,197,94,0.24)" : "1px solid rgba(239,68,68,0.24)",
          }}
        >
          {pick.badge}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/35">{pick.time}</span>
          <span
            className="px-2.5 py-1 rounded-md text-[11px] font-black leading-none"
            style={{
              color: pick.hit ? "#0E141B" : "#FCA5A5",
              background: pick.hit
                ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)"
                : "linear-gradient(180deg, rgba(127,29,29,0.35) 0%, rgba(69,10,10,0.5) 100%)",
              border: pick.hit ? "1px solid rgba(212,175,55,0.5)" : "1px solid rgba(239,68,68,0.28)",
            }}
          >
            {pick.points}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="text-left">
          <p className="text-[20px] font-black text-white leading-none flex items-center gap-1.5">
            <span aria-hidden>{pick.homeFlag}</span>
            {pick.home}
          </p>
          <p className="text-[10px] text-white/35 mt-0.5">{pick.homeName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border px-3 py-1.5 text-center" style={{ borderColor: "rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.08)" }}>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Meu palpite</p>
            <p className="text-[24px] leading-none font-black" style={{ color: C.goldLight }}>{pick.guess}</p>
          </div>
          <div className="rounded-lg border px-3 py-1.5 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Resultado</p>
            <p className="text-[24px] leading-none font-black" style={{ color: pick.hit ? "#22C55E" : "#EF4444" }}>{pick.result}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-black text-white leading-none flex items-center justify-end gap-1.5">
            {pick.away}
            <span aria-hidden>{pick.awayFlag}</span>
          </p>
          <p className="text-[10px] text-white/35 mt-0.5">{pick.awayName}</p>
        </div>
      </div>
    </article>
  );
}

export default function MeusPalpitesPage() {
  return (
    <div className="w-full max-w-xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8 space-y-4">
      <header className="space-y-2">
        
        <h1 className="text-[32px] leading-none font-black text-white tracking-tight">Meus Palpites</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Histórico completo dos seus palpites no bolão
        </p>
      </header>

      <section
        className="rounded-[20px] border p-4 relative overflow-hidden"
        style={{ background: C.card, borderColor: "rgba(255,255,255,0.07)" }}
      >
        <HeroGlow />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(255,232,186,0.68)" }}>
                Temporada 2026
              </p>
              <h3 className="text-[20px] font-black text-white leading-tight mt-1">Performance dos seus palpites</h3>
              <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Acompanhe evolução por rodada e consistência dos acertos.
              </p>
            </div>

            <span
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black"
              style={{
                color: C.goldLight,
                background: "rgba(212,175,55,0.12)",
                border: "1px solid rgba(212,175,55,0.3)",
              }}
            >
              15 pts
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATS.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="rounded-xl px-3 py-2.5 border" style={{ borderColor: "rgba(212,175,55,0.25)", background: "rgba(212,175,55,0.08)" }}>
            <div className="flex items-center justify-between text-[12px] mb-2">
              <span style={{ color: "rgba(255,255,255,0.55)" }}>Taxa de acerto geral</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>12/16 palpites</span>
                <span className="font-black" style={{ color: C.goldLight }}>75%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.09)" }}>
              <div className="h-full rounded-full" style={{ width: "75%", background: "linear-gradient(90deg, #B8860B 0%, #D4AF37 55%, #FFE8BA 100%)" }} />
            </div>
            <div className="mt-2 grid grid-cols-3 text-[10px]">
              <span style={{ color: "rgba(255,255,255,0.4)" }}>0%</span>
              <span className="text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Meta 70%</span>
              <span className="text-right" style={{ color: "rgba(255,255,255,0.4)" }}>100%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Histórico"
          right={<span className="text-[11px] text-white/35">16 palpites</span>}
        />

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold border"
              style={{
                background: item.active ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.03)",
                borderColor: item.active ? "rgba(212,175,55,0.38)" : "rgba(255,255,255,0.08)",
                color: item.active ? C.goldLight : "rgba(255,255,255,0.55)",
              }}
            >
              {item.label} <span className="opacity-70">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {PICKS.map((pick) => (
            <PickCard key={pick.id} pick={pick} />
          ))}
        </div>
      </section>
    </div>
  );
}
