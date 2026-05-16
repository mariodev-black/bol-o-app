"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoutAccountButton } from "@/app/(authenticated)/perfil/LogoutAccountButton";
import { loadOwnedTicketsMerged } from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";
import type { AffiliateSummary } from "@/app/(authenticated)/indique/affiliate-types";
import { formatBRLFromCents } from "@/app/(authenticated)/indique/affiliate-types";
import { fetchAffiliateSummaryCached } from "@/app/(authenticated)/indique/affiliate-summary-cache";
import { WithdrawGanhosModal } from "@/app/(authenticated)/indique/WithdrawGanhosModal";
import bannerRanking from "@/app/assets/banner-ranking.png";
import { useAuth } from "@/app/shared/AuthContext";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { avatarUploadImageSrc, isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ChevronRight,
  CircleHelp,
  Clock,
  Crown,
  FileText,
  Hexagon,
  Pencil,
  Percent,
  Shield,
  Target,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PerfilAvatarPickerDialog } from "./PerfilAvatarPickerDialog";
import { PerfilSegurancaDialog } from "./PerfilSegurancaDialog";

const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";

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

type SettingsItem =
  | { kind: "password"; icon: LucideIcon; title: string; subtitle: string }
  | { kind: "link"; icon: LucideIcon; title: string; subtitle: string; href: string };

const settingsItems: SettingsItem[] = [
  { kind: "password", icon: Shield, title: "Segurança", subtitle: "Alterar senha" },
  { kind: "link", icon: CircleHelp, title: "Ajuda e Suporte", subtitle: "FAQ e atendimento", href: "/indique" },
  { kind: "link", icon: FileText, title: "Política de Privacidade", subtitle: "Seus dados e privacidade", href: "/privacidade" },
];

function nextTierProgress(affiliate: AffiliateSummary | null): {
  nextLabel: string;
  remaining: number;
  progressPct: number;
} {
  if (!affiliate) {
    return { nextLabel: "Prata", remaining: 0, progressPct: 0 };
  }
  const { currentTier, paidReferralsCount, config } = affiliate;
  if (currentTier === "diamond") {
    return { nextLabel: "—", remaining: 0, progressPct: 100 };
  }
  const tierOrder: Array<{
    id: AffiliateSummary["currentTier"];
    nextLabel: string;
    min: number;
    prevMin: number;
  }> = [
    { id: "bronze", nextLabel: "Prata", min: config.tierSilverMinCommissions, prevMin: 0 },
    { id: "silver", nextLabel: "Ouro", min: config.tierGoldMinCommissions, prevMin: config.tierSilverMinCommissions },
    { id: "gold", nextLabel: "Diamante", min: config.tierDiamondMinCommissions, prevMin: config.tierGoldMinCommissions },
  ];
  const row = tierOrder.find((t) => t.id === currentTier);
  if (!row) return { nextLabel: "Prata", remaining: 0, progressPct: 0 };
  const span = Math.max(1, row.min - row.prevMin);
  const progress = Math.min(100, Math.max(0, ((paidReferralsCount - row.prevMin) / span) * 100));
  const remaining = Math.max(0, row.min - paidReferralsCount);
  return { nextLabel: row.nextLabel, remaining, progressPct: progress };
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

function EliteShieldBadge() {
  return (
    <div className="relative shrink-0" aria-hidden>
      <div
        className="pointer-events-none absolute -inset-3 rounded-full opacity-70 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(177,235,11,0.55) 0%, transparent 70%)" }}
      />
      <div className="relative flex size-[72px] items-center justify-center sm:size-20">
        <Hexagon
          className="absolute size-[72px] text-primary drop-shadow-[0_0_14px_rgba(177,235,11,0.45)] sm:size-20"
          strokeWidth={1.35}
          fill="rgba(177,235,11,0.12)"
        />
        <Crown className="relative z-10 size-7 text-primary sm:size-8" strokeWidth={2} />
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, ready, applySessionUser, logout } = useAuth();
  const [recentPicks, setRecentPicks] = useState<RecentPick[]>([]);
  const [resumo, setResumo] = useState<{ palpites: number; acertos: number; pontos: number; exatos: number } | null>(
    null
  );
  const [affiliate, setAffiliate] = useState<AffiliateSummary | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [profileDataLoading, setProfileDataLoading] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [segurancaDialogOpen, setSegurancaDialogOpen] = useState(false);

  const reloadAffiliateSummary = useCallback(async () => {
    if (!ready) return;
    try {
      setAffiliate(await fetchAffiliateSummaryCached());
    } catch {
      /* ignore */
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setTicketsLoading(true);
    void loadOwnedTicketsMerged()
      .then((list) => {
        if (!cancelled) setTicketCount(list.length);
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setProfileDataLoading(true);
      try {
        const [hRes, rRes, aRes] = await Promise.all([
          fetch("/api/palpites/historico?limit=10", { credentials: "include", cache: "no-store" }),
          fetch("/api/palpites/resumo", { credentials: "include", cache: "no-store" }),
          fetchAffiliateSummaryCached().catch(() => null),
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
          const mapped = hJson.historico.map((h) => ({
            id: String(h.matchId),
            home: h.mandante,
            away: h.visitante,
            homeLogo: h.escudoMandante ?? null,
            awayLogo: h.escudoVisitante ?? null,
            guess: `${h.palpiteCasa}x${h.palpiteVisitante}`,
            result:
              h.resultadoCasa != null && h.resultadoVisitante != null
                ? `${h.resultadoCasa}x${h.resultadoVisitante}`
                : "—",
            hit: h.pontos > 0,
            matchInfo: `${h.jogoData}${h.jogoHora ? ` · ${h.jogoHora}` : ""}`,
            points: h.pontos > 0 ? `+${h.pontos} pts` : "0 pts",
            pointsNum: h.pontos,
          }));
          if (!cancelled) setRecentPicks(mapped);
        }
        const rJson = (await rRes.json()) as { resumo?: typeof resumo };
        if (!cancelled && rRes.ok && rJson.resumo) setResumo(rJson.resumo);
        if (!cancelled) setAffiliate(aRes);
      } catch {
        if (!cancelled) {
          setRecentPicks([]);
          setResumo(null);
          setAffiliate(null);
        }
      } finally {
        if (!cancelled) setProfileDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const overviewTiles = useMemo(() => {
    const taxa =
      resumo && resumo.palpites > 0
        ? `${Math.round((resumo.acertos / Math.max(1, resumo.palpites)) * 100)}%`
        : "0%";
    const boloesLabel =
      ticketCount === 0
        ? "Nenhum bolão ativo"
        : ticketCount === 1
          ? "1 bolão ativo"
          : `${ticketCount} bolões ativos`;
    const ticketsLabel =
      ticketCount === 0 ? "0 disponíveis" : ticketCount === 1 ? "1 disponível" : `${ticketCount} disponíveis`;
    return [
      { label: "Meus Bolões", value: boloesLabel, href: "/boloes", icon: Trophy },
      { label: "Tickets", value: ticketsLabel, href: "/boloes", icon: Ticket },
      { label: "Taxa", value: taxa, href: "/meus-palpites", icon: Percent },
      { label: "Desempenho", value: "Ver histórico", href: "/meus-palpites", icon: Target },
    ];
  }, [ticketCount, resumo]);

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Jogador";
  const avatarIndex = clampAvatarIndex(user?.avatarIndex ?? 0);
  const customAvatar =
    user?.avatarUploadFilename && isStoredAvatarUploadFilename(user.avatarUploadFilename.trim())
      ? user.avatarUploadFilename.trim()
      : null;
  const nivelAfiliado = affiliate?.currentTierLabel ?? "—";
  const tierProgress = useMemo(() => nextTierProgress(affiliate), [affiliate]);
  const sessionLoading = !ready;
  const statsLoading = sessionLoading || profileDataLoading;
  const affiliateLoading = sessionLoading || profileDataLoading;
  const overviewLoading = statsLoading || ticketsLoading;

  return (
    <div className="min-h-screen w-full bg-black pb-16 text-white">
      <div className="mx-auto w-full max-w-lg px-3 pt-1 sm:px-4">
        {/* Hero — referência: rótulo + título + escudo */}
        <header className="flex items-start justify-between gap-3 pb-5 pt-1">
          <div className="min-w-0">
            <p className="font-helvetica-now-display text-[12px] font-black uppercase tracking-[0.22em] text-primary">
              Centro do Jogador
            </p>
            <h1 className="mt-1.5 font-helvetica-now-display text-[1.65rem] font-black leading-[1.05] tracking-tight text-white sm:text-[2rem]">
              Perfil <span className="text-primary">Elite</span>
            </h1>
            <p className="mt-2 max-w-[16rem] text-[13px] font-medium leading-snug text-white/50">
              Gestão completa da sua conta, desempenho e status.
            </p>
          </div>
          <EliteShieldBadge />
        </header>

        {/* Cartão do usuário */}
        <section
          className="relative overflow-hidden rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:p-5"
          style={{ borderColor: BORDER, background: CARD }}
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-4">
              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                disabled={!ready || !user}
                className="group relative shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] disabled:pointer-events-none disabled:opacity-50"
                aria-label="Alterar avatar"
              >
                <div className="relative size-[4.5rem] overflow-hidden rounded-[7px] ring-primary/0 transition-[box-shadow,transform] group-hover:ring-2 group-hover:ring-primary/35 group-active:scale-[0.98] sm:size-20">
                  {sessionLoading ? (
                    <SkeletonBlock className="size-full rounded-2xl bg-white/10" />
                  ) : customAvatar ? (
                    <Image
                      src={avatarUploadImageSrc(customAvatar)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : (
                    <Image
                      src={getAvatarPresetImage(avatarIndex)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  )}
                </div>
                <span
                  className="pointer-events-none absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1a] shadow-md"
                  aria-hidden
                >
                  <Camera className="size-3.5 text-white/70" strokeWidth={2.2} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-helvetica-now-display text-2xl font-black text-white sm:text-[1.75rem]">
                  {sessionLoading ? <SkeletonBlock className="h-8 w-36" /> : displayName}
                </p>
                <p className="mt-1 truncate text-[13px] text-white/55">
                  {sessionLoading ? <SkeletonBlock className="h-4 w-48" /> : user?.email}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarDialogOpen(true)}
                    disabled={!ready || !user}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 text-[11px] font-black uppercase tracking-wide text-primary transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Pencil className="size-3.5" strokeWidth={2.2} />
                    Editar perfil
                  </button>
                  
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
              {[
                { k: "palpites", label: "Palpites", value: resumo?.palpites, accent: false },
                { k: "acertos", label: "Acertos", value: resumo?.acertos, accent: true },
                { k: "pontos", label: "Pontos", value: resumo?.pontos, accent: false },
              ].map((col) => (
                <div
                  key={col.k}
                  className="rounded-xl border border-white/[0.06] bg-black/30 px-2 py-2.5 text-center sm:px-3"
                >
                  {statsLoading ? (
                    <SkeletonBlock className="mx-auto h-7 w-10" />
                  ) : (
                    <p
                      className={`font-helvetica-now-display text-[1.35rem] font-black tabular-nums leading-none sm:text-2xl ${
                        col.accent ? "text-primary" : "text-white"
                      }`}
                    >
                      {col.value ?? "—"}
                    </p>
                  )}
                  <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/80 sm:text-[12px]">
                    {col.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Últimos palpites */}
        <section
          className="mt-4 overflow-hidden rounded-2xl border"
          style={{ borderColor: BORDER, background: CARD }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" strokeWidth={2.2} />
              <h2 className="font-helvetica-now-display text-[15px] font-black uppercase tracking-wide text-white">
                Últimos Palpites
              </h2>
            </div>
            <Link
              href="/meus-palpites"
              className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wide text-primary"
            >
              Ver todos
              <ChevronRight className="size-4" strokeWidth={2.4} />
            </Link>
          </div>
          <div className="max-h-[min(52vh,380px)] overflow-y-auto">
            {profileDataLoading ? (
              <div className="space-y-0 p-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <SkeletonBlock className="h-10 flex-1" />
                    <SkeletonBlock className="h-6 w-12" />
                    <SkeletonBlock className="size-4 rounded" />
                  </div>
                ))}
              </div>
            ) : recentPicks.length === 0 && ready ? (
              <p className="px-4 py-10 text-center text-[13px] text-white/40">
                Nenhum palpite recente.{" "}
                <Link href="/boloes" className="font-bold text-primary underline-offset-2 hover:underline">
                  Ver bolões
                </Link>
              </p>
            ) : (
              recentPicks.map((pick) => (
                <Link
                  key={pick.id}
                  href="/meus-palpites"
                  className="flex items-center justify-between gap-2 border-b border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold leading-snug text-white sm:text-[13px]">
                      <span className="inline-flex items-center gap-1">
                        {pick.homeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pick.homeLogo} alt="" className="size-4 shrink-0 object-contain" />
                        ) : null}
                        <span className="truncate">{pick.home}</span>
                      </span>
                      <span className="text-white/80"> x </span>
                      <span className="inline-flex items-center gap-1">
                        {pick.awayLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pick.awayLogo} alt="" className="size-4 shrink-0 object-contain" />
                        ) : null}
                        <span className="truncate">{pick.away}</span>
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-white/80">{pick.matchInfo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-helvetica-now-display text-sm font-black tabular-nums text-primary sm:text-base">
                      {pick.result}
                    </span>
                    <ChevronRight className="size-4 text-white/25" strokeWidth={2.2} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Nível & progresso */}
        <section
          className="mt-4 rounded-2xl border p-4 sm:p-5"
          style={{ borderColor: BORDER, background: CARD }}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-700/40 bg-gradient-to-b from-amber-700/30 to-amber-950/50 shadow-inner">
              <Trophy className="size-6 text-amber-400/90" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-helvetica-now-display text-[11px] font-black uppercase tracking-[0.14em] text-primary">
                Nível &amp; progresso
              </h2>
              {affiliateLoading ? (
                <div className="mt-2 space-y-2">
                  <SkeletonBlock className="h-5 w-32" />
                  <SkeletonBlock className="h-3 w-full" />
                </div>
              ) : (
                <>
                  <p className="mt-1 font-helvetica-now-display text-lg font-black text-white">{nivelAfiliado}</p>
                  <p className="mt-0.5 text-[12px] text-white/50">Continue assim e evolua de nível!</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: affiliateLoading ? "22%" : `${tierProgress.progressPct}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-primary">
              {affiliateLoading ? (
                "Carregando…"
              ) : affiliate?.currentTier === "diamond" ? (
                "Você está no nível máximo do programa de indicação."
              ) : (
                <>
                  <span className="font-black">{tierProgress.remaining}</span> indicações pagas até o próximo nível (
                  {tierProgress.nextLabel})
                </>
              )}
            </p>
            <Link
              href="/indique"
              className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wide text-primary"
            >
              Ver detalhes
              <ChevronRight className="size-4" strokeWidth={2.4} />
            </Link>
          </div>
        </section>

        {/* Saldos e saque */}
        <section className="mt-4 rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="size-5 text-primary" strokeWidth={2.2} />
            <h2 className="font-helvetica-now-display text-[11px] font-black uppercase tracking-[0.14em] text-primary">
              Saldos e saque
            </h2>
          </div>
          {affiliateLoading ? (
            <SkeletonBlock className="h-24 w-full rounded-xl" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <p className="text-[12px] font-black uppercase tracking-wider text-white/40">Afiliado</p>
                  <p className="mt-1 font-helvetica-now-display text-lg font-black tabular-nums text-white">
                    {formatBRLFromCents(affiliate?.balances.availableCents ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <p className="text-[12px] font-black uppercase tracking-wider text-white/40">Conta</p>
                  <p className="mt-1 font-helvetica-now-display text-lg font-black tabular-nums text-primary">
                    {formatBRLFromCents(affiliate?.balances.walletBalanceCents ?? 0)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(true)}
                className="mt-4 flex h-12 w-full items-center justify-center gap-1 rounded-xl bg-primary font-helvetica-now-display text-[16px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_8px_24px_rgba(177,235,11,0.25)] transition-transform active:scale-[0.99]"
              >
                Sacar
                <ChevronRight className="size-4" strokeWidth={2.6} />
              </button>
              <Link
                href="/saques"
                className="mt-2 block text-center text-[11px] font-semibold text-white/40 hover:text-white/55"
              >
                Histórico de saques
              </Link>
            </>
          )}
        </section>

        {/* Visão geral 2×2 */}
        <section className="mt-5">
          <h2 className="mb-2.5 font-helvetica-now-display text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
            Visão geral
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {overviewTiles.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-[108px] flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121212] p-3.5 transition-colors hover:border-primary/25 hover:bg-[#161616] sm:p-4"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                    <Icon className="size-4 text-primary" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="mt-2 font-helvetica-now-display text-[16px] font-black text-white">{item.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-white/80">
                      {overviewLoading ? <SkeletonBlock className="mt-1 h-3 w-20" /> : item.value}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Configurações */}
        <section id="configuracoes" className="mt-5 scroll-mt-28">
          <h2 className="mb-2.5 font-helvetica-now-display text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
            Configurações
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const inner = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                      <Icon className="size-[18px] text-white/55" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white">{item.title}</p>
                      <p className="truncate text-[11px] text-white/40">{item.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-white/25" strokeWidth={2.2} />
                </>
              );
              const className =
                "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#121212] px-3 py-3.5 text-left transition-colors hover:border-white/15 sm:px-4";
              if (item.kind === "password") {
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setSegurancaDialogOpen(true)}
                    className={className}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link key={item.title} href={item.href} className={className}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-6 pb-4">
          <LogoutAccountButton />
        </div>
      </div>

      <PerfilAvatarPickerDialog
        open={avatarDialogOpen && Boolean(user)}
        onClose={() => setAvatarDialogOpen(false)}
        currentIndex={avatarIndex}
        uploadFilename={user?.avatarUploadFilename ?? null}
        onSaved={applySessionUser}
      />

      <PerfilSegurancaDialog
        open={segurancaDialogOpen && Boolean(user)}
        onClose={() => setSegurancaDialogOpen(false)}
        onSuccessAfterChange={async () => {
          await logout();
          router.replace("/login?msg=senha_alterada");
        }}
      />

      <WithdrawGanhosModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        summary={affiliate}
        summaryLoading={affiliateLoading}
        onReloadSummary={reloadAffiliateSummary}
      />
    </div>
  );
}
