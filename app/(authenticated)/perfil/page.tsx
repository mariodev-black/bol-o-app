"use client";

import Link from "next/link";
import { LogoutAccountButton } from "@/app/(authenticated)/perfil/LogoutAccountButton";
import { loadOwnedTicketsMerged } from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";
import type { AffiliateSummary } from "@/app/(authenticated)/indique/affiliate-types";
import { useAuth } from "@/app/shared/AuthContext";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  CircleHelp,
  Crown,
  FileText,
  Medal,
  Shield,
  Target,
  Ticket,
  Trophy,
  User2,
} from "lucide-react";

type RecentPick = {
  id: string;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  guess: string;
  result: string;
  hit: boolean;
  matchInfo: string;
  points: string;
  pointsNum: number;
};

const settingsItems = [
  { icon: Shield, title: "Segurança", subtitle: "Alterar senha", href: "/perfil" },
  { icon: CircleHelp, title: "Ajuda e Suporte", subtitle: "FAQ e atendimento", href: "/indique" },
  { icon: FileText, title: "Política de Privacidade", subtitle: "Seus dados e privacidade", href: "/privacidade" },
];

function userInitials(name: string | null, email: string): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0]?.trim();
  return (local?.slice(0, 2) || "??").toUpperCase();
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="h-px flex-1 ml-3" style={{ background: "linear-gradient(90deg, rgba(177,235,11,0.5) 0%, rgba(177,235,11,0) 100%)" }} />
      <h2 className="text-[18px] uppercase tracking-[0.12em] font-black" style={{ color: "rgba(217,255,89,0.82)" }}>
        {title}
      </h2>
      <div className="h-px flex-1 ml-3" style={{ background: "linear-gradient(90deg, rgba(177,235,11,0.5) 0%, rgba(177,235,11,0) 100%)" }} />
    </div>
  );
}

export default function PerfilPage() {
  const { user, ready } = useAuth();
  const [recentPicks, setRecentPicks] = useState<RecentPick[]>([]);
  const [resumo, setResumo] = useState<{ palpites: number; acertos: number; pontos: number; exatos: number } | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateSummary | null>(null);
  const [bestTicketPts, setBestTicketPts] = useState<number | null>(null);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    if (!ready) return;
    void loadOwnedTicketsMerged().then((list) => setTicketCount(list.length));
  }, [ready, user?.id]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [hRes, rRes, aRes, rankRes] = await Promise.all([
          fetch("/api/palpites/historico?limit=10", { credentials: "include", cache: "no-store" }),
          fetch("/api/palpites/resumo", { credentials: "include", cache: "no-store" }),
          fetch("/api/affiliate/summary", { credentials: "include", cache: "no-store" }).catch(() => null),
          fetch("/api/palpites/ranking", { credentials: "include", cache: "no-store" }),
        ]);
        const hJson = (await hRes.json()) as {
          historico?: Array<{
            matchId: number;
            mandante: string;
            visitante: string;
            escudoMandante?: string | null;
            escudoVisitante?: string | null;
            palpiteCasa: number;
            palpiteVisitante: number;
            resultadoCasa: number | null;
            resultadoVisitante: number | null;
            jogoData: string;
            jogoHora?: string;
            pontos: number;
          }>;
        };
        if (hRes.ok && Array.isArray(hJson.historico)) {
          setRecentPicks(
            hJson.historico.map((h) => ({
              id: String(h.matchId),
              home: h.mandante,
              away: h.visitante,
              homeLogo: h.escudoMandante ?? null,
              awayLogo: h.escudoVisitante ?? null,
              guess: `${h.palpiteCasa}x${h.palpiteVisitante}`,
              result:
                h.resultadoCasa != null && h.resultadoVisitante != null
                  ? `${h.resultadoCasa}x${h.resultadoVisitante}`
                  : "-",
              hit: h.pontos > 0,
              matchInfo: `${h.jogoData}${h.jogoHora ? ` · ${h.jogoHora}` : ""} · Copa 2026`,
              points: h.pontos > 0 ? `+${h.pontos} pts` : "0 pts",
              pointsNum: h.pontos,
            }))
          );
        }
        const rJson = (await rRes.json()) as { resumo?: typeof resumo };
        if (rRes.ok && rJson.resumo) setResumo(rJson.resumo);
        if (aRes?.ok) {
          const aj = (await aRes.json()) as { summary?: AffiliateSummary };
          if (aj.summary) setAffiliate(aj.summary);
        }
        const rk = (await rankRes.json()) as { ranking?: Array<{ totalPoints: number }> };
        if (rankRes.ok && Array.isArray(rk.ranking) && rk.ranking.length > 0) {
          setBestTicketPts(rk.ranking[0]!.totalPoints);
        } else setBestTicketPts(null);
      } catch {}
    })();
  }, [ready]);

  const pickSummary = useMemo(() => {
    const hits = recentPicks.filter((p) => p.hit).length;
    const miss = Math.max(0, recentPicks.length - hits);
    const totalPts = recentPicks.reduce((acc, p) => acc + p.pointsNum, 0);
    const rate = recentPicks.length > 0 ? Math.round((hits / recentPicks.length) * 100) : 0;
    return { hits, miss, totalPts, rate };
  }, [recentPicks]);

  const highlights = useMemo(() => {
    const taxa =
      resumo && resumo.palpites > 0
        ? `${Math.round((resumo.acertos / Math.max(1, resumo.palpites)) * 100)}%`
        : "—";
    return [
      { label: "Meus Bolões", value: `${ticketCount} ticket(s)`, href: "/boloes", icon: Trophy },
      { label: "Tickets", value: `${ticketCount} na carteira`, href: "/boloes", icon: Ticket },
      { label: "Taxa (acertos/palpites)", value: taxa, href: "/meus-palpites", icon: Target },
    ];
  }, [ticketCount, resumo]);

  const achievements = useMemo(() => {
    const p = resumo?.palpites ?? 0;
    const ex = resumo?.exatos ?? 0;
    const pts = resumo?.pontos ?? 0;
    const paidRef = affiliate?.paidReferralsCount ?? 0;
    const tier = affiliate?.currentTier ?? "bronze";
    const obt = (ok: boolean) => (ok ? ("obtida" as const) : ("bloqueada" as const));
    return [
      { label: "Primeiro palpite", subtitle: "Salvou ao menos 1 palpite", icon: Target, status: obt(p >= 1) },
      { label: "Placar exato", subtitle: "Pelo menos 1 placar exato", icon: Medal, status: obt(ex >= 1) },
      { label: "Maratonista", subtitle: "10+ palpites registrados", icon: Crown, status: obt(p >= 10) },
      { label: "Pontuador", subtitle: "30+ pontos no bolão", icon: Trophy, status: obt(pts >= 30) },
      { label: "Indicador", subtitle: "1+ indicação paga", icon: User2, status: obt(paidRef >= 1) },
      { label: "Rede de ouro", subtitle: "Nível Ouro ou Diamante no programa", icon: Trophy, status: obt(tier === "gold" || tier === "diamond") },
    ];
  }, [resumo, affiliate]);

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Jogador";
  const initials = user ? userInitials(user.name, user.email) : "…";
  const nivelAfiliado = affiliate?.currentTierLabel ?? "—";
  const metaIndicacoes = affiliate?.config.tierDiamondMinCommissions ?? 50;
  const progressPct =
    affiliate && metaIndicacoes > 0 ? Math.min(100, (affiliate.paidReferralsCount / metaIndicacoes) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 w-full max-w-7xl mx-auto gap-4 lg:gap-5">
      <header className="pt-1">
        <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(218,182,130,0.85)" }}>
          Centro do Jogador
        </p>
        <h1 className="mt-1 text-[34px] sm:text-[38px] leading-none font-black text-white tracking-tight">Perfil Elite</h1>
        <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,0.52)" }}>
          Gestão completa da sua conta, desempenho e status.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-5 items-start">
        <div className="space-y-4 lg:space-y-5 min-w-0">
          <section
            className="rounded-[18px] p-5 border relative overflow-hidden"
            style={{
              borderColor: "rgba(255,255,255,0.07)",
              background: "#0A0E19",
              boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
            }}
          >
            <HeroCardAmbientGlow radiusClass="rounded-[18px]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-[70px] h-[70px] rounded-2xl bg-[#B1EB0B] text-[#0E141B] flex items-center justify-center text-[22px] font-black shadow-[0_12px_24px_rgba(177,235,11,0.35)]">
                  {ready ? initials : "…"}
                  <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full flex items-center justify-center border border-[#B1EB0B] bg-[#0A0E19]">
                    <Trophy className="w-3 h-3" style={{ color: "#B1EB0B" }} />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[30px] sm:text-[32px] font-black text-white leading-[0.95] truncate">
                    {ready ? displayName : "Carregando…"}
                  </p>
                  <p className="text-[13px] mt-1 truncate" style={{ color: "rgba(255,255,255,0.62)" }}>
                    {ready && user ? user.email : " "}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  className="px-3 py-1 rounded-lg text-[11px] font-black border"
                  style={{ background: "rgba(177,235,11,0.12)", borderColor: "rgba(177,235,11,0.38)", color: "#B1EB0B" }}
                >
                  Afiliado: {nivelAfiliado}
                </span>
                <span
                  className="px-3 py-1 rounded-lg text-[11px] font-black border"
                  style={{ background: "rgba(217,255,89,0.08)", borderColor: "rgba(177,235,11,0.28)", color: "#E8FF8A" }}
                >
                  {affiliate ? `${affiliate.paidReferralsCount} ind. pagas` : "—"}
                </span>
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Palpites", value: String(resumo?.palpites ?? "—"), color: "white" },
                { label: "Acertos", value: String(resumo?.acertos ?? "—"), color: "#22C55E" },
                { label: "Pontos", value: String(resumo?.pontos ?? "—"), color: "#FACC15" },
                { label: "Melhor bolão", value: bestTicketPts != null ? `${bestTicketPts} pts` : "—", color: "#E8FF8A" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl px-3 py-2.5 border"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <p className="text-[26px] leading-none font-black" style={{ color: item.color }}>
                    {item.value}
                  </p>
                  <p className="text-[11px] mt-1 uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.48)" }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, #0D1628 0%, #0A0E19 100%)" }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <h2 className="text-[22px] font-black text-white">Últimos Palpites</h2>
              <Link href="/meus-palpites" className="text-sm font-bold inline-flex items-center gap-1" style={{ color: "#B1EB0B" }}>
                Ver todos <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div
              className="hidden lg:grid grid-cols-[1fr_120px_120px_120px] px-6 py-2 text-[10px] font-black uppercase tracking-[0.12em] border-b"
              style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span>Partida</span>
              <span className="text-right">Meu palpite</span>
              <span className="text-right">Resultado</span>
              <span className="text-right">Pontos</span>
            </div>
            <div className="px-3 py-2">
              {recentPicks.length === 0 && ready ? (
                <p className="text-center text-sm py-8" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Nenhum palpite recente.{" "}
                  <Link href="/boloes" className="font-bold underline" style={{ color: "#B1EB0B" }}>
                    Ver meus bolões
                  </Link>
                </p>
              ) : null}
              {recentPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="grid grid-cols-[24px_1fr_auto_auto] lg:grid-cols-[24px_1fr_120px_120px_120px] items-center gap-3 px-2 lg:px-3 py-2.5 border-b border-l-2 last:border-b-0"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    borderLeftColor: pick.hit ? "rgba(34,197,94,0.65)" : "rgba(239,68,68,0.65)",
                  }}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: pick.hit ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: pick.hit ? "#22C55E" : "#EF4444" }} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      <span className="inline-flex items-center gap-1.5">
                        {pick.homeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pick.homeLogo} alt={pick.home} className="w-4 h-4 object-contain" />
                        ) : null}
                        <span>{pick.home}</span>
                      </span>{" "}
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>vs</span>{" "}
                      <span className="inline-flex items-center gap-1.5">
                        {pick.awayLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pick.awayLogo} alt={pick.away} className="w-4 h-4 object-contain" />
                        ) : null}
                        <span>{pick.away}</span>
                      </span>
                    </p>
                    <p className="hidden lg:block text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>
                      {pick.matchInfo}
                    </p>
                  </div>
                  <p className="text-sm font-black text-right" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {pick.guess}
                  </p>
                  <p className="text-sm font-black text-right" style={{ color: pick.hit ? "#22C55E" : "#EF4444" }}>
                    {pick.result}
                  </p>
                  <div className="hidden lg:flex justify-end">
                    <span
                      className="px-2.5 py-1 rounded-lg text-[12px] font-black"
                      style={{
                        color: pick.hit ? "#86EFAC" : "#FCA5A5",
                        background: pick.hit ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        border: pick.hit ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(239,68,68,0.28)",
                      }}
                    >
                      {pick.points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="hidden lg:flex items-center justify-between px-4 py-2.5 border-t"
              style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.42)" }}
            >
              <div className="flex items-center gap-4 text-[12px]">
                <span>
                  <span style={{ color: "#22C55E" }}>●</span> {pickSummary.hits} acertos
                </span>
                <span>
                  <span style={{ color: "#EF4444" }}>●</span> {pickSummary.miss} erros
                </span>
                <span>
                  Taxa: <span style={{ color: "#B1EB0B", fontWeight: 700 }}>{pickSummary.rate}%</span>
                </span>
              </div>
              <p className="text-[12px]">
                Total: <span style={{ color: "#E8FF8A", fontWeight: 700 }}>{pickSummary.totalPts >= 0 ? "+" : ""}{pickSummary.totalPts} pts</span>
              </p>
            </div>
          </section>

          <section
            className="rounded-2xl border p-3 lg:p-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(11,16,29,0.94) 0%, rgba(9,14,25,0.95) 100%)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <SectionHeader title="Conquistas" />
              <span
                className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-[0.08em]"
                style={{ color: "#22C55E", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.28)" }}
              >
                {achievements.filter((a) => a.status === "obtida").length} / {achievements.length} desbloqueadas
              </span>
            </div>

            <div className="h-1 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.09)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${achievements.length ? (achievements.filter((a) => a.status === "obtida").length / achievements.length) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #B1EB0B, #E8FF8A)",
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {achievements.map((badge) => (
                <div
                  key={badge.label}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: badge.status === "bloqueada" ? "rgba(255,255,255,0.08)" : "rgba(177,235,11,0.28)",
                    background:
                      badge.status === "bloqueada"
                        ? "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)"
                        : "linear-gradient(180deg, rgba(14,20,35,0.96) 0%, rgba(9,14,25,0.96) 100%)",
                    opacity: badge.status === "bloqueada" ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className="w-10 h-10 rounded-xl border flex items-center justify-center"
                      style={{
                        borderColor: badge.status === "bloqueada" ? "rgba(255,255,255,0.12)" : "rgba(177,235,11,0.34)",
                        background: badge.status === "bloqueada" ? "rgba(255,255,255,0.03)" : "rgba(177,235,11,0.12)",
                      }}
                    >
                      <badge.icon className="w-5 h-5" style={{ color: badge.status === "bloqueada" ? "rgba(255,255,255,0.4)" : "#B1EB0B" }} />
                    </span>
                    <span
                      className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-[0.08em]"
                      style={{
                        color: badge.status === "bloqueada" ? "rgba(255,255,255,0.55)" : "#86EFAC",
                        background: badge.status === "bloqueada" ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.14)",
                        border: badge.status === "bloqueada" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(34,197,94,0.3)",
                      }}
                    >
                      {badge.status === "bloqueada" ? "Bloqueada" : "Obtida"}
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-white">{badge.label}</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
                    {badge.subtitle}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:space-y-5 lg:sticky lg:top-20">
          <section
            className="rounded-2xl border p-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(10,14,25,0.96)" }}
          >
            <SectionHeader title="Nível & Progresso" />
            <div className="mt-3">
              <p className="text-sm font-bold text-white">{nivelAfiliado}</p>
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                {affiliate ? `${affiliate.paidReferralsCount} indicações pagas · próx.: ${(affiliate.nextRewardCents / 100).toFixed(2).replace(".", ",")}` : "Programa de indicação"}
              </p>
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #B1EB0B, #E8FF8A)" }} />
              </div>
              <p className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                {affiliate
                  ? `${affiliate.paidReferralsCount}/${metaIndicacoes} até meta Diamante (config.)`
                  : "Carregue a página com sessão para ver progresso."}
              </p>
            </div>
          </section>

          <section>
            <SectionHeader title="Visão Geral" />
            <div className="grid grid-cols-3 gap-2.5">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-xl border p-3 lg:p-4 transition-all duration-200 hover:-translate-y-px text-center min-h-[108px] flex flex-col items-center justify-center"
                    style={{
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "linear-gradient(180deg, rgba(11,17,30,0.96) 0%, rgba(8,12,22,0.96) 100%)",
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span
                        className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0"
                        style={{ borderColor: "rgba(177,235,11,0.28)", background: "rgba(177,235,11,0.1)" }}
                      >
                        <Icon className="w-4 h-4" style={{ color: "#B1EB0B" }} />
                      </span>
                      <p className="text-[12px] font-bold text-white leading-tight">{item.label}</p>
                      <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.58)" }}>
                        {item.value}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,14,26,0.96)" }}
          >
            <h2 className="px-4 py-3 border-b text-[18px] font-black text-white" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              Configurações
            </h2>
            {settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="w-full px-4 py-3 border-b last:border-b-0 flex items-center justify-between text-left"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl border flex items-center justify-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: "rgba(255,255,255,0.56)" }} />
                    </span>
                    <span>
                      <p className="text-[14px] font-bold text-white">{item.title}</p>
                      <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {item.subtitle}
                      </p>
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
                </Link>
              );
            })}
          </section>

          <LogoutAccountButton />
        </aside>
      </div>
    </div>
  );
}

function HeroCardAmbientGlow({ radiusClass }: { radiusClass: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden z-0 ${radiusClass}`} aria-hidden>
      <div
        className="absolute"
        style={{
          top: "-32%",
          right: "-30%",
          width: "100%",
          height: "88%",
          background:
            "radial-gradient(ellipse 78% 68% at 84% 10%, rgba(217, 255, 89, 0.34) 0%, rgba(217, 255, 89, 0.11) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-34%",
          left: "-30%",
          width: "95%",
          height: "82%",
          background:
            "radial-gradient(ellipse 72% 62% at 12% 90%, rgba(177, 235, 11, 0.26) 0%, rgba(177, 235, 11, 0.08) 42%, transparent 74%)",
        }}
      />
    </div>
  );
}

