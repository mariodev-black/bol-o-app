"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/shared/AuthContext";
import {
  Gift,
  Trophy,
  Gem,
  Medal,
  MousePointerClick,
  UserPlus,
  Wallet,
  Zap,
  Link2,
  Check,
  ArrowRight,
  Copy,
  Ticket,
  ShieldCheck,
  BarChart3,
  Share2,
  Sparkles,
  Banknote,
  Target,
  CircleDollarSign,
} from "lucide-react";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";
import bannerAfiliados from "@/app/assets/banner-afiliados.png";
import type { AffiliateSummary, ReferralTierId } from "./affiliate-types";
import { formatBRLFromCents, simulateTotalForNewPaidReferrals } from "./affiliate-types";
import { fetchAffiliateSummaryCached } from "./affiliate-summary-cache";
import { WithdrawGanhosModal } from "./WithdrawGanhosModal";

/* ─── Design tokens ─── */
const C = {
  card: "#101010",
  nested: "rgba(255,255,255,0.04)",
  deep: "#020509",
  gold: "#B1EB0B",
  goldMid: "#E8FF8A",
  goldLight: "#E8FF8A",
  /** Platina / “Diamante” sem azul — identidade verde + neutro premium */
  platinum: "#C5D0E0",
  platinumMuted: "rgba(197,208,224,0.55)",
  /** Valores monetários / crédito — seguem o verde da marca. */
  value: "#B1EB0B",
  valueMuted: "#D7FF59",
  valueSoft: "rgba(177, 235, 11, 0.10)",
  valueBorder: "rgba(177, 235, 11, 0.28)",
  /** WhatsApp: cor oficial só no ícone; superfície neutra como o resto do app */
  wa: "#25D366",
} as const;

const SHARE_TITLE = "Bolão do Milhão — indicação";

type ReferredUserRow = { id: string; name: string | null; createdAt: string };

function formatRelativeTimePt(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (!Number.isFinite(sec) || sec < 0) return "";
  if (sec < 60) return "agora há pouco";
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`;
  if (sec < 172800) return "ontem";
  if (sec < 604800) return `há ${Math.floor(sec / 86400)} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function referralInitial(name: string | null): string {
  const t = name?.trim();
  if (!t) return "?";
  const c = t[0]!;
  return /[a-zA-ZÀ-ÿà-ÿ]/.test(c) ? c.toUpperCase() : "?";
}

function ReferralActivityList({
  commissions,
  pendingSignups,
  loading,
}: {
  commissions: AffiliateSummary["commissionActivity"];
  pendingSignups: ReferredUserRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="text-[12px] py-4 text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
        Carregando atividade…
      </p>
    );
  }
  if (commissions.length === 0 && pendingSignups.length === 0) {
    return (
      <p className="text-[12px] py-4 text-center leading-relaxed px-1" style={{ color: "rgba(255,255,255,0.35)" }}>
        Nenhum pagamento confirmado ainda. Quando um indicado pagar um ticket, o valor aparece aqui. Cadastros com seu
        código também aparecem abaixo como “aguardando compra”.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0 mt-4">
      {commissions.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center justify-between py-3"
          style={i < commissions.length - 1 || pendingSignups.length ? { borderBottom: "1px solid rgba(255,255,255,0.05)" } : {}}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[15px] font-black shrink-0"
              style={{
                background: "rgba(255, 255, 255, 0.07)",
                border: "1.5px solid rgba(255, 255, 255, 0.2)",
                color: "rgba(255, 255, 255, 0.5)",
              }}
            >
              {referralInitial(item.referredName)}
            </div>

            <div className="min-w-0">
              <p className="text-[13px] leading-snug mb-1">
                <span className="font-bold text-white">{item.referredName?.trim() || "Indicado"}</span>
                <span style={{ color: "rgba(255,255,255,0.45)" }}> — pagamento aprovado</span>
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                {formatRelativeTimePt(item.createdAt)} · #{item.commissionIndex} · {item.tier}
              </p>
            </div>
          </div>

          <span
            className="text-[12px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
            style={{ color: C.value, background: C.valueSoft, border: `1px solid ${C.valueBorder}` }}
          >
            +{formatBRLFromCents(item.amountCents)}
          </span>
        </div>
      ))}
      {pendingSignups.map((item, j) => (
        <div
          key={`p-${item.id}`}
          className="flex items-center justify-between py-3"
          style={j < pendingSignups.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.05)" } : {}}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[15px] font-black shrink-0"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1.5px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.35)",
              }}
            >
              {referralInitial(item.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] leading-snug mb-1">
                <span className="font-bold text-white">{item.name?.trim() || "Novo usuário"}</span>
                <span style={{ color: "rgba(255,255,255,0.38)" }}> cadastrou com seu código</span>
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Aguardando primeira compra paga · {formatRelativeTimePt(item.createdAt)}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold shrink-0 px-2 py-1 rounded-full" style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
            —
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ─── */
export default function IndiqueGanhePage() {
  const { user, ready } = useAuth();
  const [simExtraPaid, setSimExtraPaid] = useState(10);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [affiliateSummary, setAffiliateSummary] = useState<AffiliateSummary | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const reloadAffiliateSummary = useCallback(async () => {
    if (!ready || !user) {
      setAffiliateSummary(null);
      return;
    }
    setAffiliateLoading(true);
    try {
      setAffiliateSummary(await fetchAffiliateSummaryCached());
    } catch {
      setAffiliateSummary(null);
    } finally {
      setAffiliateLoading(false);
    }
  }, [ready, user?.id]);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    if (!ready || !user) {
      setAffiliateSummary(null);
      return;
    }
    void reloadAffiliateSummary();
  }, [ready, user?.id, reloadAffiliateSummary]);

  const code = user?.referralCode?.trim() ?? "";
  const signupLink =
    origin && code ? `${origin}/cadastrar?ref=${encodeURIComponent(code)}` : origin ? `${origin}/cadastrar` : "";

  const whatsappInviteText = useMemo(
    () => `Entra no Bolão do Milhão com meu link — na hora de cadastrar usa meu código! 🎯\n${signupLink}`,
    [signupLink]
  );

  const cfg = affiliateSummary?.config;
  const paidIndicacoes = affiliateSummary?.paidReferralsCount ?? 0;
  const isInfluencer = affiliateSummary?.affiliateMode === "influencer";
  const cpaFmt = `${((affiliateSummary?.influencerCpaBps ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}% CPA`;
  const totalRecebidoFmt = formatBRLFromCents(affiliateSummary?.balances.totalEarnedCents ?? 0);
  const porIndicacaoFmt = isInfluencer ? cpaFmt : cfg ? formatBRLFromCents(affiliateSummary?.nextRewardCents ?? cfg.rewardBronzeCents) : "—";
  const currentTierLabel = isInfluencer ? "Influencer CPA" : affiliateSummary?.currentTierLabel ?? "Bronze";
  const goalDiamond = cfg?.tierDiamondMinCommissions ?? 50;
  const diamondPerFmt = isInfluencer ? cpaFmt : cfg ? formatBRLFromCents(cfg.rewardDiamondCents) : "—";

  // ── Lógica por etapas (Bronze → Prata → Ouro → Diamante) ──────────────
  const TIER_ORDER: ReferralTierId[] = ["bronze", "silver", "gold", "diamond"];
  const TIER_LABELS: Record<ReferralTierId, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", diamond: "Diamante" };

  const currentTierId: ReferralTierId = isInfluencer ? "diamond" : (affiliateSummary?.currentTier ?? "bronze");
  const currentTierIdx = TIER_ORDER.indexOf(currentTierId);
  const atMaxTier = currentTierIdx >= TIER_ORDER.length - 1;
  const nextTierId: ReferralTierId = atMaxTier ? "diamond" : TIER_ORDER[currentTierIdx + 1]!;

  const tierMinByCfg: Record<ReferralTierId, number> = cfg
    ? { bronze: 0, silver: cfg.tierSilverMinCommissions, gold: cfg.tierGoldMinCommissions, diamond: cfg.tierDiamondMinCommissions }
    : { bronze: 0, silver: 10, gold: 25, diamond: 50 };
  const tierRewardByCfg: Record<ReferralTierId, number> = cfg
    ? { bronze: cfg.rewardBronzeCents, silver: cfg.rewardSilverCents, gold: cfg.rewardGoldCents, diamond: cfg.rewardDiamondCents }
    : { bronze: 0, silver: 0, gold: 0, diamond: 0 };

  const currentTierMin = tierMinByCfg[currentTierId];
  const nextTierMin = tierMinByCfg[nextTierId];
  const nextTierRewardFmt = isInfluencer ? cpaFmt : formatBRLFromCents(tierRewardByCfg[nextTierId]);
  const nextTierLabelStr = TIER_LABELS[nextTierId];

  // Progresso apenas até a próxima etapa (não até Diamante)
  const remainingToNext = atMaxTier ? 0 : Math.max(0, nextTierMin - paidIndicacoes);
  const tierBarRange = nextTierMin - currentTierMin;
  const tierBarPct = atMaxTier
    ? 100
    : tierBarRange > 0
      ? Math.min(100, ((paidIndicacoes - currentTierMin) / tierBarRange) * 100)
      : 100;

  // Progresso visual da linha no "Jornada de Níveis"
  // Formula: (tierIdx + fractionWithinTier) / (totalTiers - 1) * 100
  const TOTAL_TIERS = TIER_ORDER.length; // 4
  const lineProgressPct = isInfluencer || atMaxTier
    ? 100
    : ((currentTierIdx + tierBarPct / 100) / (TOTAL_TIERS - 1)) * 100;

  // mantido para referência no hero (meta final = Diamante)
  const remainingToDiamond = isInfluencer ? 0 : Math.max(0, goalDiamond - paidIndicacoes);

  const tierRows = useMemo(() => {
    if (!cfg) {
      return [
        { label: "Bronze", threshold: "—", active: true,  completed: false, color: "#CD7F32",  Icon: Medal },
        { label: "Prata",  threshold: "—", active: false, completed: false, color: "#A8A9AD",  Icon: Medal },
        { label: "Ouro",   threshold: "—", active: false, completed: false, color: C.gold,     Icon: Trophy },
        { label: "Diamante", threshold: "—", active: false, completed: false, color: C.platinum, Icon: Gem },
      ];
    }
    const cur = affiliateSummary?.currentTier ?? "bronze";
    const order: ReferralTierId[] = ["bronze", "silver", "gold", "diamond"];
    const curIdx = order.indexOf(cur);
    const labels = { bronze: "Bronze", silver: "Prata", gold: "Ouro", diamond: "Diamante" };
    const thresholds: Record<ReferralTierId, string> = {
      bronze: `1–${cfg.tierSilverMinCommissions - 1}`,
      silver: `${cfg.tierSilverMinCommissions}–${cfg.tierGoldMinCommissions - 1}`,
      gold: `${cfg.tierGoldMinCommissions}–${cfg.tierDiamondMinCommissions - 1}`,
      diamond: `${cfg.tierDiamondMinCommissions}+`,
    };
    return order.map((tid, idx) => ({
      label: labels[tid],
      threshold: thresholds[tid],
      active: cur === tid,
      completed: idx < curIdx,
      color: tid === "bronze" ? "#CD7F32" : tid === "silver" ? "#A8A9AD" : tid === "gold" ? C.gold : C.platinum,
      Icon: tid === "gold" ? Trophy : tid === "diamond" ? Gem : Medal,
    }));
  }, [cfg, affiliateSummary?.currentTier]);

  const howSteps = useMemo(() => {
    const bronzeFmt = cfg ? formatBRLFromCents(cfg.rewardBronzeCents) : "R$ 8,00";
    return [
      {
        Icon: Link2,
        color: C.gold,
        title: "Compartilhe seu link",
        desc: "Envie para amigos pelo WhatsApp, Instagram ou qualquer canal.",
      },
      {
        Icon: Ticket,
        color: C.goldMid,
        title: "Amigos compram o ticket",
        desc: "Cada pagamento aprovado (PIX) do indicado gera comissão para você.",
      },
      {
        Icon: Zap,
        color: C.goldMid,
        title: "Você recebe na hora",
        desc: isInfluencer
          ? `${cpaFmt} do valor pago creditado após confirmação do pagamento.`
          : `${bronzeFmt} ou mais creditados após confirmação do pagamento, conforme seu nível.`,
      },
    ];
  }, [cfg, cpaFmt, isInfluencer]);

  const simTotalCents = useMemo(() => {
    // Usa a taxa ATUAL flat (taxa vigente × quantidade)
    // O usuário quer ver: "se eu fizer X indicações ao meu preço atual, quanto ganho?"
    const currentRateCents = affiliateSummary?.nextRewardCents ?? cfg?.rewardBronzeCents ?? 0;
    return currentRateCents * simExtraPaid;
  }, [affiliateSummary?.nextRewardCents, cfg?.rewardBronzeCents, simExtraPaid]);

  const copyText = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fallback abaixo */
    }
    if (typeof document === "undefined") return false;
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const copyReferralLink = useCallback(async () => copyText(signupLink), [copyText, signupLink]);

  const copyReferralCode = useCallback(async () => copyText(code), [copyText, code]);

  const handleCopy = useCallback(async () => {
    const ok = await copyReferralLink();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }, [copyReferralLink]);

  const handleCopyCode = useCallback(async () => {
    const ok = await copyReferralCode();
    if (ok) {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2200);
    }
  }, [copyReferralCode]);

  const openWhatsAppInvite = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappInviteText)}`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }, [whatsappInviteText]);

  const handleShareInvite = useCallback(async () => {
    const shareData = {
      title: SHARE_TITLE,
      text: `Use meu link para participar:\n${signupLink}`,
      url: signupLink,
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    const ok = await copyReferralLink();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }, [copyReferralLink, signupLink]);

  return (
    <main className="min-h-screen bg-black pb-24 text-white">
      <section className="relative h-[200px] max-h-[200px] overflow-hidden">
          <Image
            src={bannerAfiliados}
            alt="Programa de indicação Bolão do Milhão"
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className="object-cover object-[60%_center]"
          />

          <div className="relative z-10 flex h-full flex-col p-3">
          

            <div className="mt-2 max-w-[235px]">
              <h1 className="font-helvetica-now-display text-[19px] font-black italic uppercase leading-[1] tracking-[0.040em] text-white [paint-order:stroke_fill] [-webkit-text-stroke:0.65px_rgba(255,255,255,0.95)]">
                Indique amigos e
                <span className="block text-primary [-webkit-text-stroke:0.65px_currentColor] text-[21px]">ganhe dinheiro!</span>
              </h1>
              <p className="mt-2 max-w-[180px] text-[11.5px] font-medium leading-snug text-white/82">
                Cada amigo que comprar um ticket rende{" "}
                <span className="font-black text-primary">{porIndicacaoFmt}</span> na próxima indicação paga.
              </p>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-1.5">
              <div className="flex h-[48px] items-center gap-2 rounded-[9px] border border-white/10 bg-black/52 px-2 backdrop-blur-[2px]">
                <Trophy className="size-4 shrink-0 text-[#C47A37]" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/80">Seu nível atual</p>
                  <p className="mt-0.5 truncate text-[14px] font-black leading-none text-[#D48A4A]">{currentTierLabel}</p>
                </div>
              </div>
              <div className="flex h-[48px] items-center gap-2 rounded-[9px] border border-white/10 bg-black/52 px-2 backdrop-blur-[2px]">
                <CircleDollarSign className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/80">Você ganha</p>
                  <p className="mt-0.5 truncate text-[15px] font-black leading-none text-primary">{porIndicacaoFmt}</p>
                  <p className="mt-0.5 text-[7.8px] font-medium text-white">por indicação</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      <div className="mx-auto w-full max-w-[430px] px-3.5">
        

        <section className="mt-3 rounded-[14px] border border-primary/22 bg-primary/8 p-3 shadow-[0_0_24px_rgba(177,235,11,0.08)]">
          <div className="flex items-center gap-3">
            <Zap className="size-6 shrink-0 text-primary" strokeWidth={2.3} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white/72">
                Faltam <span className="font-black text-white">{remainingToNext}</span> indicações para{" "}
                <span className="font-black text-white">{nextTierLabelStr}</span> — ganhe{" "}
                <span className="font-black text-primary">{nextTierRewardFmt}/ind.</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/45">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(177,235,11,0.5)]"
                  style={{ width: `${Math.max(4, tierBarPct)}%` }}
                />
              </div>
            </div>
            <span className="rounded-full border border-primary/20 bg-black/35 px-2 py-1 text-[10px] font-black text-primary">
              {paidIndicacoes}/{nextTierMin}
            </span>
          </div>
        </section>

        <section className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/26">Seu progresso</p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: MousePointerClick, value: affiliateSummary?.signupReferralsCount ?? 0, label: "Cliques" },
              { icon: UserPlus, value: paidIndicacoes, label: "Pagas" },
              { icon: Wallet, value: totalRecebidoFmt, label: "Ganhos", highlight: true },
            ].map(({ icon: Icon, value, label, highlight }) => (
              <article
                key={label}
                className={`rounded-[13px] border p-3 text-center ${
                  highlight ? "border-primary/30 bg-primary/7" : "border-white/10 bg-[#101010]"
                }`}
              >
                <Icon className={`mx-auto size-5 ${highlight ? "text-primary" : "text-white/45"}`} strokeWidth={2.15} />
                <p className={`mt-3 truncate text-[22px] font-black leading-none ${highlight ? "text-primary" : "text-white"}`}>
                  {value}
                </p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-white/40">{label}</p>
              </article>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => setWithdrawModalOpen(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-primary/22 bg-[#101010] text-[13px] font-black text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.99]"
        >
          <CircleDollarSign className="size-4" strokeWidth={2.3} />
          Sacar ganhos
        </button>

        <section className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-[15px] border border-white/10 bg-[#101010] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/34">Seu código</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="truncate text-[18px] font-black tracking-[0.16em] text-white">{code || "------"}</p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-white/10 bg-black/30 px-3 text-[10px] font-bold text-white/70"
              >
                <Copy className="size-3.5" />
                {codeCopied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-5 text-[10px] font-medium text-white/35">Compartilhe seu link</p>
            <div className="mt-2 truncate rounded-[9px] border border-white/8 bg-black/35 px-3 py-2 text-[10px] text-white/32">
              {signupLink || "Gerando link..."}
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary text-[12px] font-black text-black active:scale-[0.99]"
              >
                <Copy className="size-4" />
                {copied ? "Link copiado" : "Copiar link"}
              </button>
              <button
                type="button"
                onClick={openWhatsAppInvite}
                className="flex h-11 items-center justify-center rounded-[10px] border border-white/10 bg-black/30 text-[#25D366]"
                aria-label="Enviar no WhatsApp"
              >
                <Share2 className="size-5" />
              </button>
            </div>
          </article>

          <article className="rounded-[15px] border border-white/10 bg-[#101010] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/34">Jornada de níveis</p>
            <div className="relative mt-5 grid grid-cols-4 gap-2">
              <span className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-white/10" />
              <span
                className="absolute left-[12.5%] top-5 h-px bg-primary"
                style={{ width: `${Math.min(75, Math.max(0, lineProgressPct * 0.75))}%` }}
              />
              {tierRows.map(({ label, threshold, active, completed, color, Icon }) => (
                <div key={label} className="relative z-1 flex flex-col items-center text-center">
                  <span
                    className="flex size-10 items-center justify-center rounded-full border bg-[#101010]"
                    style={{
                      borderColor: active || completed ? color : "rgba(255,255,255,0.12)",
                      color: active || completed ? color : "rgba(255,255,255,0.28)",
                    }}
                  >
                    <Icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <p className="mt-2 text-[9px] font-black text-white/72">{label}</p>
                  <p className="mt-0.5 text-[8px] font-medium text-white/36">{threshold}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[1fr_28px_1fr] items-center rounded-[12px] border border-white/8 bg-black/24 p-3">
              <div>
                <p className="text-[9px] font-black uppercase text-white/35">Agora</p>
                <p className="mt-1 text-[19px] font-black leading-none text-primary">{porIndicacaoFmt}</p>
                <p className="mt-1 text-[9px] text-white/42">por indicação</p>
              </div>
              <span className="text-center text-white/25">→</span>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-white/35">No {nextTierLabelStr}</p>
                <p className="mt-1 text-[19px] font-black leading-none text-white">{nextTierRewardFmt}</p>
                <p className="mt-1 text-[9px] text-white/42">por indicação</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] font-medium text-white/40">
              {paidIndicacoes} de {nextTierMin} indicações pagas · +{remainingToNext} para {nextTierLabelStr}
            </p>
          </article>
        </section>

        <section className="mt-3 rounded-[15px] border border-white/10 bg-[#101010] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/34">Atividade recente</p>
          <ReferralActivityList
            commissions={affiliateSummary?.commissionActivity ?? []}
            pendingSignups={affiliateSummary?.pendingSignupReferrals ?? []}
            loading={affiliateLoading}
          />
        </section>
      </div>

      <WithdrawGanhosModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        summary={affiliateSummary}
        summaryLoading={affiliateLoading}
        onReloadSummary={reloadAffiliateSummary}
      />
    </main>
  );

  return (
    <div className="min-h-screen pb-8">
      <style>{`
        @keyframes indiqueFade {
          from { opacity: 0.45; }
          to   { opacity: 1;    }
        }
      `}</style>

      <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-8 lg:max-w-7xl">

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
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">

          <div className="flex flex-col gap-3 md:gap-4">
            {/* Hero — mobile */}
            <div
              className="rounded-[18px] p-5 md:hidden overflow-hidden relative"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <HeroCardAmbientGlow radiusClass="rounded-[18px]" />
              <div className="relative z-1">
              <div className="mb-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full"
                  style={{ background: `${C.gold}1A`, border: `1px solid ${C.gold}45` }}
                >
                  <Gift size={11} style={{ color: C.goldLight }} />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.goldLight }}>
                    Programa de Indicação
                  </span>
                </span>
              </div>

              <h1 className="text-[26px] font-black text-white leading-[1.2] tracking-[-0.01em] mb-2.5">
                Indique amigos e<br />ganhe dinheiro
              </h1>
              <p className="text-[13px] leading-[1.6] mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                Cada amigo que comprar um ticket rende{" "}
                <span className="font-bold" style={{ color: C.goldMid }}>{porIndicacaoFmt}</span> na próxima indicação paga.
              </p>

              <div className="flex gap-2.5 mb-4">
                <div
                  className="flex-1 rounded-xl p-3"
                  style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}30` }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#FFFFFF59" }}>
                    Nível atual
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Trophy size={14} style={{ color: C.gold }} />
                    <span className="text-[15px] font-black" style={{ color: C.gold }}>{currentTierLabel}</span>
                  </div>
                </div>
                <div
                  className="flex-1 rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#FFFFFF59" }}>
                    Por indicação
                  </p>
                  <p className="text-[18px] font-black text-white tracking-[-0.01em]">{porIndicacaoFmt}</p>
                </div>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
                style={{ background: "rgba(217,255,89,0.08)", border: "1px solid rgba(177,235,11,0.22)" }}
              >
                <Zap size={13} style={{ color: C.gold }} className="shrink-0" />
                <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {atMaxTier ? (
                    <>
                      Você está no nível{" "}
                      <span className="font-bold" style={{ color: C.platinum }}>Diamante</span>
                      {" — "}
                      <span className="font-bold" style={{ color: C.goldMid }}>{diamondPerFmt}/ind.</span>
                    </>
                  ) : remainingToNext > 0 ? (
                    <>
                      Faltam <span className="font-bold text-white">{remainingToNext} indicações</span> para{" "}
                      <span className="font-bold" style={{ color: C.platinum }}>{nextTierLabelStr}</span>
                      {" — "}
                      <span className="font-bold" style={{ color: C.goldMid }}>ganhe {nextTierRewardFmt}/ind.</span>
                    </>
                  ) : (
                    <>
                      Você atingiu o nível <span className="font-bold" style={{ color: C.platinum }}>{nextTierLabelStr}</span>
                      {" — "}
                      <span className="font-bold" style={{ color: C.goldMid }}>{nextTierRewardFmt}/ind.</span>
                    </>
                  )}
                </p>
              </div>
              </div>
            </div>

            {/* Hero — desktop (layout referência) */}
            <div
              className="hidden md:block rounded-[22px] overflow-hidden relative"
              style={{
                background: C.card,
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <HeroCardAmbientGlow radiusClass="rounded-[22px]" />
              <div className="relative z-1 px-8 pt-8 pb-6">
                <div className="mb-5">
                  <span
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                    style={{ background: "rgba(177,235,11,0.08)", border: `1px solid rgba(177,235,11,0.42)` }}
                  >
                    <Sparkles size={13} style={{ color: C.gold }} strokeWidth={2.2} />
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: C.goldMid }}>
                      Programa de Indicação
                    </span>
                  </span>
                </div>

                <h1 className="text-[40px] font-black text-white leading-[1.15] tracking-[-0.02em] mb-4 max-w-[720px]">
                  Indique amigos e ganhe{" "}
                  <span style={{ color: C.goldMid }}>dinheiro</span>
                </h1>
                <p className="text-[15px] leading-[1.65] max-w-[640px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                  Cada amigo que comprar um ticket vale{" "}
                  <span className="font-bold" style={{ color: C.value }}>{porIndicacaoFmt} na próxima indicação paga</span>
                  . Quanto mais indicações, maior o nível e maior o bônus por amigo.
                </p>

                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{
                      background: "rgba(177,235,11,0.06)",
                      border: `1px solid rgba(177,235,11,0.35)`,
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Nível atual
                    </p>
                    <div className="flex items-center gap-2.5 mt-auto">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(177,235,11,0.12)", border: "1px solid rgba(177,235,11,0.25)" }}
                      >
                        <Medal size={22} style={{ color: C.gold }} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-black tracking-tight" style={{ color: C.gold }}>{currentTierLabel}</span>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Por indicação
                    </p>
                    <div className="flex items-center gap-2.5 mt-auto">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: C.valueSoft, border: `1px solid ${C.valueBorder}` }}
                      >
                        <Banknote size={22} style={{ color: C.valueMuted }} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-black tracking-tight" style={{ color: C.value }}>{porIndicacaoFmt}</span>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4 flex flex-col justify-center min-h-[108px]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Zap size={18} style={{ color: C.gold }} className="shrink-0 mt-0.5" />
                      <p className="text-[13px] font-semibold leading-[1.45]" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {atMaxTier ? (
                          <>
                            <span className="inline-flex items-center gap-0.5 text-white font-bold">
                              <Gem size={14} style={{ color: C.platinum }} className="inline shrink-0" strokeWidth={2} />
                              <span style={{ color: C.platinum }}>Nível Diamante</span>
                            </span>
                            {" — "}
                            <span className="font-bold" style={{ color: C.goldMid }}>{diamondPerFmt}/ind.</span>
                          </>
                        ) : remainingToNext > 0 ? (
                          <>
                            <span className="text-white font-bold">+ {remainingToNext} ind.</span>
                            {" "}para{" "}
                            <span className="inline-flex items-center gap-0.5 text-white font-bold">
                              <Gem size={14} style={{ color: C.platinum }} className="inline shrink-0" strokeWidth={2} />
                              <span style={{ color: C.platinum }}>{nextTierLabelStr}</span>
                            </span>
                            {" "}
                            <span className="font-bold" style={{ color: C.goldMid }}>{nextTierRewardFmt}/ind.</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-0.5 text-white font-bold">
                              <Gem size={14} style={{ color: C.platinum }} className="inline shrink-0" strokeWidth={2} />
                              <span style={{ color: C.platinum }}>Meta {nextTierLabelStr} ✓</span>
                            </span>
                            {" "}
                            <span className="font-bold" style={{ color: C.goldMid }}>{nextTierRewardFmt}/ind.</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="relative z-1 flex justify-between items-stretch border-t border-white/8"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                <div className="flex-1 flex flex-col items-center justify-center gap-1 py-4 px-3 min-w-0">
                  <MousePointerClick size={20} style={{ color: C.valueMuted }} strokeWidth={2} />
                  <span className="text-[26px] font-black text-white leading-none tracking-[-0.02em]">—</span>
                  <span className="text-[10px] font-medium text-center leading-snug" style={{ color: "rgba(255,255,255,0.36)" }}>
                    Cliques no seu link
                  </span>
                </div>

                <div
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-4 px-3 min-w-0 border-l border-r border-white/6"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Target size={20} style={{ color: C.goldMid }} strokeWidth={2} />
                  <span className="text-[26px] font-black text-white leading-none tracking-[-0.02em]">{paidIndicacoes}</span>
                  <span className="text-[10px] font-medium text-center leading-snug" style={{ color: "rgba(255,255,255,0.36)" }}>
                    Indicações pagas
                  </span>
                </div>

                <div
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-4 px-3 min-w-0"
                  style={{
                    background: "rgba(177,235,11,0.05)",
                    borderLeft: `1px solid ${C.valueBorder}`,
                  }}
                >
                  <Wallet size={20} style={{ color: C.valueMuted }} strokeWidth={2} />
                  <span className="text-[26px] font-black leading-none tracking-[-0.02em]" style={{ color: C.value }}>{totalRecebidoFmt}</span>
                  <span className="text-[10px] font-medium text-center leading-snug" style={{ color: "rgba(255,255,255,0.36)" }}>
                    Total recebido
                  </span>
                </div>
              </div>

              <div
                className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/8 px-6 lg:px-8 py-3.5"
                style={{ background: "rgba(0,0,0,0.22)" }}
              >
                <p className="text-[12px] leading-snug max-w-md hidden lg:block" style={{ color: "rgba(255,255,255,0.38)" }}>
                  Use seu saldo de indicações quando quiser — solicite o saque em poucos passos.
                </p>
                <SacarGanhosLink onOpen={() => setWithdrawModalOpen(true)} className="shrink-0 w-full sm:w-auto justify-center" />
              </div>
            </div>

            {/* ── SEU PROGRESSO — mobile only ── */}
            <div className="md:hidden">
              <SmallLabel className="mb-2.5">Seu Progresso</SmallLabel>
              <div className="grid grid-cols-3 gap-2">
                <StatCard Icon={MousePointerClick} iconColor="rgba(255,255,255,0.45)" value="—" label="Cliques" />
                <StatCard Icon={UserPlus} iconColor={C.gold} value={String(paidIndicacoes)} label="Pagas" valueColor={C.gold} />
                <StatCard Icon={Wallet} iconColor={C.valueMuted} value={totalRecebidoFmt} label="Ganhos" valueColor={C.value} highlight />
              </div>
              <SacarGanhosLink onOpen={() => setWithdrawModalOpen(true)} variant="pill" className="mt-3" />
            </div>

            {/* ── CÓDIGO + LINK — mobile only ── */}
            <div
              className="md:hidden rounded-2xl p-4"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Seu código e link</SectionHeader>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-mono text-[18px] font-black tracking-[0.14em] text-white truncate min-w-0"
                    title={code || undefined}
                  >
                    {!ready ? "…" : code || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    disabled={!code}
                    className="h-9 px-3 rounded-[10px] text-[11px] font-black shrink-0 disabled:opacity-40"
                    style={{
                      background: codeCopied
                        ? `linear-gradient(135deg, #5F7F06, ${C.gold} 55%, #E8FF8A)`
                        : "rgba(255,255,255,0.06)",
                      color: codeCopied ? "#0E141B" : C.goldMid,
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    {codeCopied ? "Copiado" : "Copiar código"}
                  </button>
                </div>
                <div
                  className="rounded-[10px] px-3 py-2.5 text-[11px] leading-snug break-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                >
                  {signupLink || (ready ? "Carregando link…" : "…")}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="flex-1 h-10 rounded-[10px] text-[12px] font-black flex items-center justify-center gap-1.5"
                    style={{
                      background: copied
                        ? `linear-gradient(135deg, #5F7F06, ${C.gold} 55%, #E8FF8A)`
                        : `linear-gradient(135deg, #8FC900, ${C.goldMid} 50%, #DFFF76)`,
                      color: "#0E141B",
                    }}
                  >
                    {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                    {copied ? "Link copiado" : "Copiar link"}
                  </button>
                  <button
                    type="button"
                    onClick={openWhatsAppInvite}
                    className="h-10 px-3 rounded-[10px] text-[11px] font-bold shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.88)",
                    }}
                  >
                    <span className="sr-only">WhatsApp</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" className="mx-auto" aria-hidden>
                      <path fill={C.wa} d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── SEU LINK DE INDICAÇÃO — desktop only ── */}
            <div
              className="hidden md:block rounded-2xl p-5"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Seu link de indicação</SectionHeader>

              <div className="flex flex-col gap-2.5 mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Seu código
                  </span>
                  <div
                    className="flex items-center gap-2 rounded-[10px] px-3 py-2 min-w-0"
                    style={{ background: "rgba(177,235,11,0.08)", border: `1px solid ${C.valueBorder}` }}
                  >
                    <span
                      className="font-mono text-[15px] font-black tracking-[0.12em] text-white truncate"
                      title={code || undefined}
                    >
                      {!ready ? "…" : code || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      disabled={!code}
                      className="h-8 px-3 rounded-lg text-[11px] font-black tracking-wide shrink-0 disabled:opacity-40"
                      style={{
                        background: codeCopied
                          ? `linear-gradient(135deg, #5F7F06, ${C.gold} 55%, #E8FF8A)`
                          : "rgba(255,255,255,0.08)",
                        color: codeCopied ? "#0E141B" : C.goldMid,
                        border: `1px solid ${codeCopied ? "transparent" : "rgba(255,255,255,0.12)"}`,
                      }}
                    >
                      {codeCopied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div
                    className="w-full rounded-[10px] px-3.5 py-3 text-[12px] truncate flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.valueMuted }} aria-hidden />
                    <span className="truncate">{signupLink || (ready ? "Carregando…" : "…")}</span>
                  </div>
                  <p className="text-[11px] leading-normal pl-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Envie o <span className="font-semibold text-white/80">link</span> ou o{" "}
                    <span className="font-semibold text-white/80">código</span> — na página de cadastro seu amigo pode colar o código no campo de indicação.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="h-9 px-4 rounded-[10px] text-[12px] font-black tracking-[0.04em] flex items-center gap-1.5 shrink-0 active:scale-[0.97]"
                  style={{
                    transition: "transform 0.1s ease, background 0.3s ease",
                    ...(copied
                      ? { background: `linear-gradient(135deg, #5F7F06, ${C.gold} 55%, #E8FF8A)`, color: "#0E141B" }
                      : { background: `linear-gradient(135deg, #8FC900, ${C.goldMid} 50%, #DFFF76)`, color: "#0E141B" }
                    ),
                  }}
                >
                  {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} strokeWidth={2.5} />}
                  {copied ? "Copiado!" : "Copiar Link"}
                </button>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={openWhatsAppInvite}
                    className="flex px-3 items-center justify-center gap-1.5 h-9 rounded-[10px] text-[11px] font-bold whitespace-nowrap"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.88)",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
                      <path fill={C.wa} d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareInvite()}
                    className="flex px-3 items-center justify-center gap-1.5 h-9 rounded-[10px] text-[11px] font-bold whitespace-nowrap"
                    style={{
                      background: "rgba(217,255,89,0.08)",
                      border: "1px solid rgba(177,235,11,0.22)",
                      color: C.goldMid,
                    }}
                  >
                    <Share2 size={12} className="shrink-0" style={{ color: C.gold }} />
                    Compartilhar
                  </button>
                </div>
              </div>
              </div>

            </div>

            {/* ── COMO FUNCIONA ── */}
            <div
              className="rounded-2xl p-5 hidden md:block"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Como Funciona</SectionHeader>

              <div className="flex flex-col md:flex-row gap-2.5 mt-4">
                {howSteps.map((step, i) => {
                  const Icon = step.Icon;
                  return (
                    <div
                      key={i}
                      className="flex md:flex-col items-start md:items-start gap-3.5 rounded-[14px] p-4 md:flex-1"
                      style={{ background: C.nested, border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                        style={{ background: `${step.color}18`, border: `1px solid ${step.color}28` }}
                      >
                        <Icon size={20} style={{ color: step.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{ background: `${step.color}25`, color: step.color }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-[13px] font-extrabold text-white leading-none">{step.title}</p>
                        </div>
                        <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-2xl p-5 hidden md:block"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Atividade Recente</SectionHeader>

              <ReferralActivityList
                commissions={affiliateSummary?.commissionActivity ?? []}
                pendingSignups={affiliateSummary?.pendingSignupReferrals ?? []}
                loading={affiliateLoading}
              />

            </div>

          </div>
          {/* ══ END LEFT COLUMN ══ */}

          {/* ══ RIGHT COLUMN ══ */}
          <div className="flex flex-col gap-3 md:gap-4">

            {/* ── JORNADA DE NÍVEIS ── */}
            <div
              className="rounded-2xl px-4 pt-[18px] pb-5"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SmallLabel className="mb-7">Jornada de Níveis</SmallLabel>

              <div className="relative flex justify-between items-start mb-6 px-1">
                {/* track base */}
                <div className="absolute top-5 left-5 right-5 h-[2px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                  {/* fill — largura baseada no tier atual + progresso dentro do tier */}
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${lineProgressPct}%`,
                      background: `linear-gradient(90deg, ${C.gold}, ${C.goldMid})`,
                      boxShadow: "0 0 10px rgba(177,235,11,0.2)",
                    }}
                  />
                </div>

                {tierRows.map((tier) => {
                  const Icon = tier.Icon;
                  const isActive = tier.active;
                  const isCompleted = tier.completed;
                  return (
                    <div key={tier.label} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className="flex items-center justify-center rounded-full transition-all duration-300"
                        style={
                          isActive
                            ? { width: 44, height: 44, background: "#111F00", outline: `2px solid ${C.gold}`, outlineOffset: 2, boxShadow: "0 0 14px rgba(177,235,11,0.22)" }
                            : isCompleted
                              ? { width: 40, height: 40, background: "rgba(177,235,11,0.12)", border: `1px solid ${C.gold}55` }
                              : { width: 40, height: 40, background: "#0D1425", border: "1px solid rgba(255,255,255,0.08)" }
                        }
                      >
                        <Icon
                          size={isActive ? 21 : 17}
                          style={{ color: isCompleted ? C.goldMid : tier.color, opacity: (!isActive && !isCompleted) ? 0.4 : 1 }}
                        />
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: isActive ? "#fff" : isCompleted ? C.goldMid : "rgba(255,255,255,0.30)" }}>
                        {tier.label}
                      </span>
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.20)" }}>{tier.threshold}</span>
                    </div>
                  );
                })}
              </div>

              <div
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[14px] p-3.5 mb-5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "rgba(255,255,255,0.30)" }}>Agora</p>
                  <p className="text-[24px] font-black leading-none tracking-[-0.02em]" style={{ color: C.goldLight }}>{porIndicacaoFmt}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>por indic.</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ArrowRight size={14} style={{ color: "rgba(255,255,255,0.18)" }} />
                  <span className="whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold" style={{ background: C.valueSoft, border: `1px solid ${C.valueBorder}`, color: C.value }}>
                    próximo
                  </span>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "rgba(255,255,255,0.30)" }}>
                    {atMaxTier ? "Diamante ✓" : `No ${nextTierLabelStr}`}
                  </p>
                  <p className="text-[24px] font-black leading-none tracking-[-0.02em]" style={{ background: `linear-gradient(135deg, #F8FAFC, ${C.platinum} 45%, ${C.goldLight} 95%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {nextTierRewardFmt}
                  </p>
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>por indic.</p>
                </div>
              </div>

              <div className="h-[6px] rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${tierBarPct}%`,
                    background: `linear-gradient(90deg, ${C.gold}, ${C.goldMid} 55%, ${C.platinumMuted})`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  <span className="font-bold text-white">{paidIndicacoes}</span>
                  {" "}de {atMaxTier ? goalDiamond : nextTierMin} indicações pagas
                </p>
                <div className="flex items-center gap-1">
                  <Gem size={10} style={{ color: C.platinum }} />
                  <span className="text-[12px] font-bold" style={{ color: C.platinum }}>
                    {atMaxTier
                      ? "Nível máximo ✓"
                      : remainingToNext > 0
                        ? `+${remainingToNext} para ${nextTierLabelStr}`
                        : `Meta ${nextTierLabelStr} ✓`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── SIMULE SEUS GANHOS ── */}
            <div
              className="rounded-2xl"
              style={{ background: C.card }}
            >
              <div className="px-4 pt-4 pb-4">
                <SectionHeader>Simule seus Ganhos</SectionHeader>
              </div>
              <div className="px-5 pb-5">
                <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.36)" }}>
                  Quantas novas indicações pagas você projeta? (simulação com suas faixas atuais)
                </p>

                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => setSimExtraPaid((v) => Math.max(1, v - 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0 select-none active:scale-95"
                    style={{
                      background: "#00000038",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.55)",
                      transition: "transform 0.1s ease",
                    }}
                  >−</button>

                  <input
                    type="range" min={1} max={50} value={simExtraPaid}
                    onChange={(e) => setSimExtraPaid(Number(e.target.value))}
                    className="flex-1 accent-[#FAD98B] cursor-pointer"
                    style={{ height: 40 }}
                  />

                  <button
                    onClick={() => setSimExtraPaid((v) => Math.min(50, v + 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0 select-none active:scale-95"
                    style={{
                      background: "#00000038",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.55)",
                      transition: "transform 0.1s ease",
                    }}
                  >+</button>
                </div>

                <div className="text-center mb-5">
                  <span
                    key={simExtraPaid}
                    className="text-[40px] font-black text-white tracking-[-0.02em] leading-none"
                    style={{ animation: "indiqueFade 0.2s ease forwards" }}
                  >
                    {simExtraPaid}
                  </span>
                  <span className="text-[13px] font-medium ml-2" style={{ color: "rgba(255,255,255,0.38)" }}>
                    novas pagas
                  </span>
                </div>

                <div
                  className="rounded-[14px] px-5 pt-5 pb-4 mb-4 text-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(177,235,11,0.08) 0%, rgba(217,255,89,0.06) 100%)",
                    border: "1px solid #E8FF8A33",
                  }}
                >
                  <p className="text-[14px] mb-3" style={{ color: "#FFFFFF59" }}>
                    Total estimado dessas{" "}
                    <span className="font-bold text-white">{simExtraPaid}</span> novas indicações pagas
                  </p>

                  <span
                    key={simTotalCents}
                    className="text-[56px] sm:text-[72px] font-black leading-none tracking-[-0.03em] block mb-4"
                    style={{
                      animation: "indiqueFade 0.2s ease forwards",
                      background: `linear-gradient(180deg, #F7FFD9 0%, ${C.goldLight} 28%, ${C.goldMid} 62%, #C8F23A 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {formatBRLFromCents(simTotalCents)}
                  </span>

                  <div className="flex items-center justify-center gap-1.5 bg-[#FAD98B14] py-3 border-2 border-[#FAD98B33] rounded-[10px]">
                    <Gem size={11} style={{ color: "#FAD98B" }} />
                    <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Você já tem{" "}
                      <span className="font-bold text-white">{paidIndicacoes}</span> pagas · no Diamante cada uma paga{" "}
                      <span className="font-bold" style={{ color: "#FAD98B" }}>{diamondPerFmt}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="w-full h-[52px] rounded-[10px] text-[14px] font-black tracking-[0.06em] uppercase  items-center justify-center gap-2 active:scale-[0.98] flex md:hidden"
                  style={{
                    transition: "transform 0.1s ease, background 0.3s ease",
                    border: "none",
                    ...(copied
                      ? { background: `linear-gradient(135deg, #5F7F06, ${C.gold} 55%, #E8FF8A)`, color: "#0E141B" }
                      : { background: `linear-gradient(135deg, #8FC900, ${C.goldMid} 50%, #DFFF76)`, color: "#0E141B", boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }
                    ),
                  }}
                >
                  {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
                  {copied ? "Link Copiado!" : "Copiar Link Agora"}
                </button>
                <div className="hidden grid-cols-2 gap-2 md:block">
                  <button
                    type="button"
                    onClick={openWhatsAppInvite}
                    className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
                      <path fill={C.wa} d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareInvite()}
                    className="flex h-12 items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold"
                    style={{
                      background: "rgba(217,255,89,0.08)",
                      border: "1px solid rgba(177,235,11,0.25)",
                      color: C.goldMid,
                    }}
                  >
                    <Share2 size={15} className="shrink-0" style={{ color: C.gold }} />
                    Compartilhar
                  </button>
                </div>
              </div>
            </div>
            <div
              className="rounded-2xl p-5 block md:hidden"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Como Funciona</SectionHeader>

              <div className="flex flex-col md:flex-row gap-2.5 mt-4">
                {howSteps.map((step, i) => {
                  const Icon = step.Icon;
                  return (
                    <div
                      key={i}
                      className="flex md:flex-col items-start md:items-start gap-3.5 rounded-[14px] p-4 md:flex-1"
                      style={{ background: C.nested, border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                        style={{ background: `${step.color}18`, border: `1px solid ${step.color}28` }}
                      >
                        <Icon size={20} style={{ color: step.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{ background: `${step.color}25`, color: step.color }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-[13px] font-extrabold text-white leading-none">{step.title}</p>
                        </div>
                        <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* ── ATIVIDADE RECENTE ── */}
            <div
              className="rounded-2xl p-5 block md:hidden"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Atividade Recente</SectionHeader>

              <ReferralActivityList
                commissions={affiliateSummary?.commissionActivity ?? []}
                pendingSignups={affiliateSummary?.pendingSignupReferrals ?? []}
                loading={affiliateLoading}
              />

            </div>

          </div>
          {/* ══ END RIGHT COLUMN ══ */}

        </div>

        {/* ══ TRUST BAR — full width ══ */}
        <div
          className="rounded-2xl mt-3 md:mt-5 block md:hidden"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center">
            <TrustItem Icon={ShieldCheck} label="Pagamento seguro" />
            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
            <TrustItem Icon={Check} label="Confirmação imediata" />
            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
            <TrustItem Icon={BarChart3} label="Ranking transparente" />
          </div>
        </div>

      </div>
      <WithdrawGanhosModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        summary={affiliateSummary}
        summaryLoading={affiliateLoading}
        onReloadSummary={reloadAffiliateSummary}
      />
    </div>
  );
}

/* ─── Componentes ─────────────────────────────────────────── */

/** Brilho interno do hero: #E8FF8A (topo direita) + #F97316 (base esquerda), recortado ao raio do card */
function HeroCardAmbientGlow({ radiusClass }: { radiusClass: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden z-0 ${radiusClass}`}
      aria-hidden
    >
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
            "radial-gradient(ellipse 72% 62% at 12% 90%, rgba(249, 115, 22, 0.26) 0%, rgba(249, 115, 22, 0.08) 42%, transparent 74%)",
        }}
      />
    </div>
  );
}

function SacarGanhosLink({
  onOpen,
  className = "",
  variant = "default",
}: {
  onOpen: () => void;
  className?: string;
  /** Mobile: uma linha limpa, largura total, sem “caixa” extra no ícone */
  variant?: "default" | "pill";
}) {
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full min-h-[48px] items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-[14px] font-bold transition-all active:scale-[0.99] ${className}`}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${C.valueBorder}`,
          color: C.goldMid,
        }}
      >
        <CircleDollarSign size={22} strokeWidth={2.25} className="shrink-0" style={{ color: C.value }} aria-hidden />
        Sacar ganhos
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`inline-flex items-center gap-3 rounded-xl pl-2.5 pr-5 py-2 text-[13px] font-bold tracking-wide transition-all active:scale-[0.98] hover:opacity-95 ${className}`}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${C.valueBorder}`,
        color: C.goldMid,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: C.valueSoft,
          border: `1px solid ${C.valueBorder}`,
        }}
      >
        <CircleDollarSign size={22} strokeWidth={2.25} style={{ color: C.value }} aria-hidden />
      </span>
      <span>Sacar ganhos</span>
    </button>
  );
}

function SmallLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`} style={{ color: "rgba(255,255,255,0.28)" }}>
      {children}
    </p>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b-[#FFFFFF0F]">
      <div className="w-[3px] h-[18px] rounded-full" style={{ background: C.gold }} />
      <span className="text-[15px] font-bold text-white">{children}</span>
    </div>
  );
}

function StatCard({
  Icon, iconColor, value, valueColor = "#fff", label, highlight = false,
}: {
  Icon: React.ElementType; iconColor: string;
  value: string; valueColor?: string;
  label: string; highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-2.5"
      style={{
        background: highlight ? "rgba(177,235,11,0.07)" : C.card,
        border: highlight ? `1px solid ${C.valueBorder}` : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="w-[42px] h-[42px] rounded-xl flex items-center justify-center"
        style={{ background: `${iconColor}20`, border: `1px solid ${iconColor}30` }}
      >
        <Icon size={19} style={{ color: iconColor }} />
      </div>
      <span className="text-[22px] font-black leading-none" style={{ color: valueColor }}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.32)" }}>
        {label}
      </span>
    </div>
  );
}

/** Inline stat card for desktop hero row */
function StatCardInline({
  Icon, iconColor, value, valueColor = "#fff", label, highlight = false,
}: {
  Icon: React.ElementType; iconColor: string;
  value: string; valueColor?: string;
  label: string; highlight?: boolean;
}) {
  return (
    <div
      className="flex-1 flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: highlight ? "rgba(177,235,11,0.07)" : "rgba(255,255,255,0.03)",
        border: highlight ? `1px solid ${C.valueBorder}` : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="w-[36px] h-[36px] rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}20`, border: `1px solid ${iconColor}30` }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-[18px] font-black leading-none" style={{ color: valueColor }}>{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>{label}</p>
      </div>
    </div>
  );
}

function TrustItem({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 py-4">
      <Icon size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
      <span className="text-[10px] font-medium text-center leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
    </div>
  );
}
