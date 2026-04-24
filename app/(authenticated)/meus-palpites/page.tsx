"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleCheck, Clock3, Target, TriangleAlert, XCircle } from "lucide-react";

const C = {
  card: "#0A0E19",
  cardSoft: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",
  gold: "#D4AF37",
  goldLight: "#FFE8BA",
} as const;

type HistoricoRow = {
  matchId: number;
  ticketId: string;
  bolaoType: string;
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
};

type Pick = {
  id: string;
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

type FilterKey = "todos" | "exatos" | "certos" | "errados" | "pendentes";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase();
  const w = name.trim();
  return w.slice(0, 3).toUpperCase() || "?";
}

function mapHistoricoToPick(h: HistoricoRow): Pick {
  const scored = h.resultadoCasa != null && h.resultadoVisitante != null;
  let badge = "Pendente";
  if (scored) {
    if (h.exact) badge = "Placar exato";
    else if (h.pontos > 0) badge = "Acerto parcial";
    else badge = "Errado";
  }
  const hit = scored && h.pontos > 0;
  const pointsStr = scored ? (h.pontos > 0 ? `+${h.pontos} pts` : "0 pts") : "—";
  return {
    id: `${h.matchId}-${h.ticketId}`,
    badge,
    hit,
    points: pointsStr,
    home: initials(h.mandante),
    away: initials(h.visitante),
    guess: `${h.palpiteCasa}-${h.palpiteVisitante}`,
    result: scored ? `${h.resultadoCasa}-${h.resultadoVisitante}` : "—",
    time: `${h.jogoData} · ${h.jogoHora}`,
    homeName: h.mandante,
    awayName: h.visitante,
    homeFlag: "⚽",
    awayFlag: "⚽",
  };
}

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
  const neutral = pick.badge === "Pendente";
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
        style={{
          background: neutral ? "rgba(148,163,184,0.5)" : pick.hit ? "rgba(34,197,94,0.62)" : "rgba(239,68,68,0.62)",
        }}
        aria-hidden
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-[0.08em]"
          style={{
            color: neutral ? "#94A3B8" : pick.hit ? "#34D399" : "#F87171",
            background: neutral ? "rgba(148,163,184,0.12)" : pick.hit ? "rgba(34,197,94,0.10)" : "rgba(127,29,29,0.20)",
            border: neutral ? "1px solid rgba(148,163,184,0.2)" : pick.hit ? "1px solid rgba(34,197,94,0.24)" : "1px solid rgba(239,68,68,0.24)",
          }}
        >
          {pick.badge}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/35">{pick.time}</span>
          <span
            className="px-2.5 py-1 rounded-md text-[11px] font-black leading-none"
            style={{
              color: neutral ? "#94A3B8" : pick.hit ? "#0E141B" : "#FCA5A5",
              background: neutral
                ? "rgba(148,163,184,0.15)"
                : pick.hit
                  ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)"
                  : "linear-gradient(180deg, rgba(127,29,29,0.35) 0%, rgba(69,10,10,0.5) 100%)",
              border: neutral ? "1px solid rgba(148,163,184,0.25)" : pick.hit ? "1px solid rgba(212,175,55,0.5)" : "1px solid rgba(239,68,68,0.28)",
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
          <p className="text-[10px] text-white/35 mt-0.5 truncate">{pick.homeName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border px-3 py-1.5 text-center" style={{ borderColor: "rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.08)" }}>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Meu palpite</p>
            <p className="text-[24px] leading-none font-black" style={{ color: C.goldLight }}>{pick.guess}</p>
          </div>
          <div className="rounded-lg border px-3 py-1.5 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Resultado</p>
            <p className="text-[24px] leading-none font-black" style={{ color: neutral ? "#94A3B8" : pick.hit ? "#22C55E" : "#EF4444" }}>{pick.result}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-black text-white leading-none flex items-center justify-end gap-1.5">
            {pick.away}
            <span aria-hidden>{pick.awayFlag}</span>
          </p>
          <p className="text-[10px] text-white/35 mt-0.5 truncate">{pick.awayName}</p>
        </div>
      </div>
    </article>
  );
}

export default function MeusPalpitesPage() {
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [resumo, setResumo] = useState<{ palpites: number; acertos: number; pontos: number; exatos: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("todos");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [hRes, rRes] = await Promise.all([
        fetch("/api/palpites/historico?limit=100", { credentials: "include", cache: "no-store" }),
        fetch("/api/palpites/resumo", { credentials: "include", cache: "no-store" }),
      ]);
      const hJson = (await hRes.json()) as { historico?: HistoricoRow[] };
      const rJson = (await rRes.json()) as { resumo?: { palpites: number; acertos: number; pontos: number; exatos: number } };
      if (hRes.ok && Array.isArray(hJson.historico)) setHistorico(hJson.historico);
      else setHistorico([]);
      if (rRes.ok && rJson.resumo) setResumo(rJson.resumo);
      else setResumo(null);
    } catch {
      setError(true);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const picks = useMemo(() => historico.map(mapHistoricoToPick), [historico]);

  const stats = useMemo(() => {
    let certos = 0;
    let errados = 0;
    let pendentes = 0;
    let exatos = 0;
    for (const h of historico) {
      const scored = h.resultadoCasa != null && h.resultadoVisitante != null;
      if (!scored) {
        pendentes += 1;
        continue;
      }
      if (h.exact) exatos += 1;
      if (h.pontos > 0) certos += 1;
      else errados += 1;
    }
    return { exatos, certos, errados, pendentes, total: historico.length };
  }, [historico]);

  const filteredPicks = useMemo(() => {
    if (filter === "todos") return picks;
    return picks.filter((p) => {
      if (filter === "exatos") return p.badge === "Placar exato";
      if (filter === "certos") return p.badge === "Acerto parcial" || p.badge === "Placar exato";
      if (filter === "errados") return p.badge === "Errado";
      if (filter === "pendentes") return p.badge === "Pendente";
      return true;
    });
  }, [picks, filter]);

  const filterCounts = useMemo(
    () => ({
      todos: picks.length,
      exatos: picks.filter((p) => p.badge === "Placar exato").length,
      certos: picks.filter((p) => p.badge === "Acerto parcial" || p.badge === "Placar exato").length,
      errados: picks.filter((p) => p.badge === "Errado").length,
      pendentes: picks.filter((p) => p.badge === "Pendente").length,
    }),
    [picks]
  );

  const scoredCount = stats.certos + stats.errados;
  const taxa = scoredCount > 0 ? Math.round((stats.certos / scoredCount) * 100) : 0;
  const totalPts = resumo?.pontos ?? 0;

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "exatos", label: "Exatos" },
    { key: "certos", label: "Certos" },
    { key: "errados", label: "Errados" },
    { key: "pendentes", label: "Pendentes" },
  ];

  return (
    <div className="w-full max-w-xl lg:max-w-5xl mx-auto px-4 pt-6 pb-8 space-y-4">
      <header className="space-y-2">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/45 hover:text-white/70"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao perfil
        </Link>
        <h1 className="text-[32px] leading-none font-black text-white tracking-tight">Meus Palpites</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Histórico de todos os seus palpites (principal e diário), sincronizado com o servidor.
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
                Copa do Mundo 2026
              </p>
              <h3 className="text-[20px] font-black text-white leading-tight mt-1">Performance dos seus palpites</h3>
              <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Contagem considera partidas já com resultado na API.
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
              {loading ? "…" : `${totalPts} pts`}
            </span>
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-amber-200/90 text-sm py-2">
              <TriangleAlert className="w-4 h-4 shrink-0" />
              Não foi possível carregar. Tente novamente.
              <button type="button" onClick={() => void load()} className="underline font-bold">
                Recarregar
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Exatos" value={stats.exatos} tone={C.gold} icon={Target} soft="rgba(212,175,55,0.12)" />
            <StatCard label="Certos" value={stats.certos} tone="#34D399" icon={CircleCheck} soft="rgba(52,211,153,0.12)" />
            <StatCard label="Errados" value={stats.errados} tone="#FB7185" icon={XCircle} soft="rgba(251,113,133,0.12)" />
            <StatCard label="Pendentes" value={stats.pendentes} tone="#94A3B8" icon={Clock3} soft="rgba(148,163,184,0.12)" />
          </div>

          <div className="rounded-xl px-3 py-2.5 border" style={{ borderColor: "rgba(212,175,55,0.25)", background: "rgba(212,175,55,0.08)" }}>
            <div className="flex items-center justify-between text-[12px] mb-2">
              <span style={{ color: "rgba(255,255,255,0.55)" }}>Taxa de acerto (partidas com resultado)</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {stats.certos}/{scoredCount} palpites
                </span>
                <span className="font-black" style={{ color: C.goldLight }}>{taxa}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.09)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${taxa}%`, background: "linear-gradient(90deg, #B8860B 0%, #D4AF37 55%, #FFE8BA 100%)" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Histórico"
          right={<span className="text-[11px] text-white/35">{loading ? "…" : `${picks.length} palpites`}</span>}
        />

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className="shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold border"
              style={{
                background: filter === item.key ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.03)",
                borderColor: filter === item.key ? "rgba(212,175,55,0.38)" : "rgba(255,255,255,0.08)",
                color: filter === item.key ? C.goldLight : "rgba(255,255,255,0.55)",
              }}
            >
              {item.label}{" "}
              <span className="opacity-70">{filterCounts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <p className="text-center text-sm text-white/35 py-10">Carregando…</p>
          ) : filteredPicks.length === 0 ? (
            <p className="text-center text-sm text-white/35 py-10">
              Nenhum palpite neste filtro. Faça palpites em{" "}
              <Link href="/boloes" className="font-bold text-amber-200 underline">
                Meus bolões
              </Link>
              .
            </p>
          ) : (
            filteredPicks.map((pick) => <PickCard key={pick.id} pick={pick} />)
          )}
        </div>
      </section>
    </div>
  );
}
