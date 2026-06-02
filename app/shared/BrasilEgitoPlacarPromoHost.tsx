"use client";

/**
 * Promo "Acerte o placar exato — Amistoso Brasil x Egito".
 * Step 1: palpite Brasil x Egito
 * Step 2: indicação para camisa
 *
 * Estrutura independente de ChampionsPlacarPromoHost.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { StaticImageData } from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  ShieldCheck,
  Shirt,
  Ticket,
  X,
} from "lucide-react";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import { useBolaoToast } from "@/app/components/BolaoToast";
import type { BrasilEgitoPlacarPromoStatus } from "@/lib/promotions/brasil-egito-placar-promo";
import { resolveNationalTeamShieldUrl } from "@/lib/football/national-team-shields";
import brasilLogo from "@/app/assets/brasil-selecao-logo.png";
import bgPromoBrasilEgito from "@/app/assets/banner-promo-brasil-egito.png";

const EGITO_SHIELD_URL =
  resolveNationalTeamShieldUrl("Egito") ??
  "https://cdn.api-futebol.com.br/escudos/68b23f0dd2450.svg";

const PROMO_FONT =
  "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
const GREEN = "#B1EB0B";
const PROMO_Z = 156;
const OPEN_DELAY_MS = 0;
const API_PATH = "/api/promotions/brasil-egito-placar";

type Step = "offer" | "success";

const PROMO_HERO_PT_STEP1 = "pt-[220px]";

function PromoHeroShell({
  heroImage,
  topPaddingClass,
  onClose,
  children,
}: {
  heroImage: StaticImageData;
  topPaddingClass: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative w-full max-w-[390px] ${topPaddingClass}`}
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex w-full justify-center"
        aria-hidden
      >
        <Image
          src={heroImage}
          alt=""
          priority
          draggable={false}
          className="h-auto w-full select-none rounded-t-3xl drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar promoção"
        className="absolute right-1 top-1 z-30 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="relative z-10 rounded-4xl border border-white/8 bg-[#141414] px-3 pb-6 pt-7 shadow-[0_24px_48px_rgba(0,0,0,0.65)]">
        {children}
      </div>
    </div>
  );
}

function ScoreStepperColumn({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const inc = () => onChange(Math.min(99, value + 1));
  const dec = () => onChange(Math.max(0, value - 1));

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <button
        type="button"
        onClick={inc}
        className="flex size-8 items-center justify-center rounded-md bg-[#2a2a2a] ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
        aria-label={`Aumentar ${label}`}
      >
        <ChevronUp
          className="size-5"
          strokeWidth={2.5}
          style={{ color: GREEN }}
        />
      </button>
      <span className="min-w-[42px] text-center text-[42px] font-black tabular-nums leading-none text-white/90">
        {value}
      </span>
      <button
        type="button"
        onClick={dec}
        className="flex size-8 items-center justify-center rounded-md bg-[#2a2a2a] ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
        aria-label={`Diminuir ${label}`}
      >
        <ChevronDown
          className="size-5"
          strokeWidth={2.5}
          style={{ color: GREEN }}
        />
      </button>
    </div>
  );
}

function TeamLogo({
  src,
  alt,
  className,
}: {
  src: typeof brasilLogo;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={64}
      height={64}
      className={className ?? "size-[52px] shrink-0 object-contain sm:size-14"}
      draggable={false}
    />
  );
}

function TeamLogoRemote({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={64}
      height={64}
      unoptimized
      className={className ?? "size-[52px] shrink-0 object-contain sm:size-14"}
      draggable={false}
    />
  );
}

function PlacarExatoPicker({
  predCasa,
  predVisitante,
  onPredCasaChange,
  onPredVisitanteChange,
}: {
  predCasa: number;
  predVisitante: number;
  onPredCasaChange: (n: number) => void;
  onPredVisitanteChange: (n: number) => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-4">
      <p className="text-center text-[13px] font-bold leading-snug text-white">
        Qual é o placar exato do jogo?
      </p>

      <div className="mt-4 flex items-center justify-between gap-1">
        <TeamLogo src={brasilLogo} alt="Brasil" />

        <ScoreStepperColumn
          value={predCasa}
          onChange={onPredCasaChange}
          label="gols do Brasil"
        />

        <span
          className="shrink-0 px-1 text-[18px] font-bold text-white/45"
          aria-hidden
        >
          x
        </span>

        <ScoreStepperColumn
          value={predVisitante}
          onChange={onPredVisitanteChange}
          label="gols do Egito"
        />

        <TeamLogoRemote
          src={EGITO_SHIELD_URL}
          alt="Egito"
          className="size-16 shrink-0 object-contain"
        />
      </div>
    </div>
  );
}

function OfferStep({
  predCasa,
  predVisitante,
  onPredCasaChange,
  onPredVisitanteChange,
  loading,
  onSubmit,
  onClose,
  friendsGoal,
}: {
  predCasa: number;
  predVisitante: number;
  onPredCasaChange: (n: number) => void;
  onPredVisitanteChange: (n: number) => void;
  loading: boolean;
  onSubmit: () => void;
  onClose: () => void;
  friendsGoal: number;
}) {
  return (
    <PromoHeroShell
      heroImage={bgPromoBrasilEgito}
      topPaddingClass={PROMO_HERO_PT_STEP1}
      onClose={onClose}
    >
      <div id="brasil-egito-placar-promo-title" className="text-center">
        <p className="text-[15px] font-black uppercase leading-none tracking-wide text-white">
          Acerte o
        </p>
        <p
          className="mt-1 text-[32px] font-black italic uppercase leading-[0.92] tracking-tight"
          style={{ color: GREEN }}
        >
          Placar exato
        </p>
        <p className="mt-1.5 text-[14px] font-black uppercase leading-none tracking-wide text-white">
          do amistoso
        </p>
        <p
          className="mt-0.5 text-[22px] font-black uppercase leading-none tracking-tight"
          style={{ color: GREEN }}
        >
          Brasil x Egito
        </p>
      </div>

      <div className="mt-5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
        <div className="grid grid-cols-2 divide-x divide-white/10">
          <div className="flex items-start gap-2 px-2.5 py-3">
            <Ticket
              className="mt-0.5 size-5 shrink-0 text-primary"
              strokeWidth={2}
            />
            <p className="text-[10px] font-bold uppercase leading-[1.35] text-white">
              Ganhe <span className="text-primary">1 cota grátis</span>
              <br />
              <span className="text-white/90">no Bolão do Milhão</span>
            </p>
          </div>
          <div className="flex items-start gap-2 px-2.5 py-3">
            <Shirt
              className="mt-0.5 size-5 shrink-0 text-primary"
              strokeWidth={2}
            />
            <p className="text-[10px] font-bold uppercase leading-[1.35] text-white">
              Ganhe <span className="text-primary">1 camisa oficial</span>
              <br />
              <span className="text-white/90">da seleção brasileira</span>
            </p>
          </div>
        </div>
      </div>

      <PlacarExatoPicker
        predCasa={predCasa}
        predVisitante={predVisitante}
        onPredCasaChange={onPredCasaChange}
        onPredVisitanteChange={onPredVisitanteChange}
      />

      <button
        type="button"
        disabled={loading}
        onClick={onSubmit}
        className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-full bg-primary px-5 text-[14px] font-black uppercase italic tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-60"
      >
        <span className="flex-1 text-center">
          {loading ? "Salvando..." : "Salvar palpite"}
        </span>
        {!loading ? (
          <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}
      </button>

      <div className="mt-4 flex items-start gap-2">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          strokeWidth={2.2}
          aria-hidden
        />
        <p className="text-left text-[11px] font-medium leading-[1.45] text-white/75">
          Ao acertar o placar, você ganha{" "}
          <strong className="font-bold" style={{ color: GREEN }}>
            1 cota grátis
          </strong>
          . A camisa oficial será liberada ao convidar{" "}
          <strong className="font-bold" style={{ color: GREEN }}>
            {friendsGoal} amigos
          </strong>
          .
        </p>
      </div>
    </PromoHeroShell>
  );
}

function SuccessStep({
  signupLink,
  friendsInvited,
  friendsGoal,
  onClose,
}: {
  signupLink: string;
  friendsInvited: number;
  friendsGoal: number;
  onClose: () => void;
}) {
  const toast = useBolaoToast();
  const [copied, setCopied] = useState(false);
  const displayLink = signupLink.replace(/^https?:\/\//, "");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, [signupLink, toast]);

  const filled = Math.min(friendsGoal, Math.max(0, friendsInvited));

  return (
    <div
      className="relative w-full max-w-[350px] rounded-4xl border border-white/8 bg-[#141414] px-5 pb-6 pt-10 shadow-[0_24px_48px_rgba(0,0,0,0.65)]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="text-center" id="brasil-egito-placar-success-title">
        <div
          className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border-2"
          style={{ background: `${GREEN}18`, borderColor: `${GREEN}66` }}
        >
          <Check className="size-6 text-primary" strokeWidth={2.5} />
        </div>
        <p className="text-[28px] font-black italic uppercase leading-none text-white">
          Palpite
        </p>
        <p
          className="text-[28px] font-black italic uppercase leading-none"
          style={{ color: GREEN }}
        >
          registrado!
        </p>
        <p className="mt-2 text-[13px] font-medium leading-snug text-white/80">
          Agora é só chamar a galera e garantir sua{" "}
          <strong className="font-bold text-white">camisa oficial</strong>!
        </p>
      </div>

      <div className="mt-6 border-t border-white/8 pt-5">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.12em] text-white/70">
          Convide {friendsGoal} amigos e garanta
        </p>
        <p
          className="mt-1 text-center text-[15px] font-black italic uppercase leading-tight tracking-wide"
          style={{ color: GREEN }}
        >
          /// sua camisa oficial da seleção! ///
        </p>

        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: friendsGoal }, (_, i) => {
            const active = i < filled;
            return (
              <span
                key={i}
                className="flex size-7 items-center justify-center rounded-full border text-[10px] font-bold"
                style={
                  active
                    ? {
                        borderColor: `${GREEN}88`,
                        background: `${GREEN}22`,
                        color: GREEN,
                      }
                    : {
                        borderColor: "rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.35)",
                      }
                }
              >
                {i === 0 && active ? "👤" : ""}
              </span>
            );
          })}
        </div>

        <p className="mt-2 text-center">
          <span
            className="text-[24px] font-black tabular-nums"
            style={{ color: GREEN }}
          >
            {friendsInvited}
          </span>
          <span className="text-[15px] font-bold text-white/55">
            {" "}
            / {friendsGoal}
          </span>
        </p>
        <p className="text-center text-[11px] font-medium text-white/55">
          amigos convidados
        </p>

        <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
          Seu link exclusivo
        </p>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-3">
          <Link2 className="size-5 shrink-0 text-primary" strokeWidth={2.2} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">
            {displayLink}
          </span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="shrink-0 text-primary transition hover:opacity-80"
            aria-label="Copiar link"
          >
            <Copy className="size-4" strokeWidth={2.2} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-black uppercase italic tracking-wide text-[#0E141B] transition active:scale-[0.98]"
        >
          <Link2 className="size-4" strokeWidth={2.2} />
          {copied ? "Copiado!" : "Copiar link"}
        </button>

        <p className="mt-4 flex items-start gap-2 text-[11px] font-medium leading-snug text-white/75">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            strokeWidth={2.2}
          />
          <span>
            Ao completar {friendsGoal} indicações válidas, sua camisa será{" "}
            <strong className="font-bold" style={{ color: GREEN }}>
              liberada automaticamente
            </strong>
            .
          </span>
        </p>
      </div>
    </div>
  );
}

export function BrasilEgitoPlacarPromoHost({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, isLoggedIn, user } = useAuth();
  const toast = useBolaoToast();
  const isAdminRoute = useIsAdminAppRoute();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [status, setStatus] = useState<BrasilEgitoPlacarPromoStatus | null>(
    null,
  );
  const [predCasa, setPredCasa] = useState(0);
  const [predVisitante, setPredVisitante] = useState(0);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const profileBlocksPromo = Boolean(user && user.profileComplete === false);

  const refreshStatus =
    useCallback(async (): Promise<BrasilEgitoPlacarPromoStatus | null> => {
      const r = await fetch(API_PATH, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return null;
      return (await r.json()) as BrasilEgitoPlacarPromoStatus;
    }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (
      isAdminRoute ||
      !ready ||
      !isLoggedIn ||
      profileBlocksPromo ||
      !user?.id
    ) {
      setOpen(false);
      setStatus(null);
      return;
    }

    const run = async () => {
      try {
        const data = await refreshStatus();
        if (cancelled) return;
        setStatus(data);
        if (!data?.enabled || !data.showOfferModal) {
          setOpen(false);
          return;
        }
        setStep("offer");
        setPredCasa(0);
        setPredVisitante(0);
        setOpen(true);
      } catch {
        if (!cancelled) {
          setStatus(null);
          setOpen(false);
        }
      }
    };

    if (OPEN_DELAY_MS > 0) {
      timer = setTimeout(() => void run(), OPEN_DELAY_MS);
    } else {
      void run();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    isAdminRoute,
    ready,
    isLoggedIn,
    profileBlocksPromo,
    user?.id,
    refreshStatus,
  ]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(API_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ predCasa, predVisitante }),
      });
      const data = (await r
        .json()
        .catch(() => ({}))) as BrasilEgitoPlacarPromoStatus & {
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error ?? "Não foi possível salvar o palpite.");
        return;
      }
      setStatus(data);
      setStep("success");
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [predCasa, predVisitante, toast]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const showModal = open && status != null && !isAdminRoute;

  const modalOverlay =
    showModal && portalReady ? (
      <div
        className="fixed inset-0 flex max-h-dvh items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-[2px]"
        style={{ zIndex: PROMO_Z }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          step === "offer"
            ? "brasil-egito-placar-promo-title"
            : "brasil-egito-placar-success-title"
        }
        onClick={handleClose}
      >
        <div className="my-auto flex w-full justify-center py-2">
          {step === "offer" ? (
            <OfferStep
              predCasa={predCasa}
              predVisitante={predVisitante}
              onPredCasaChange={setPredCasa}
              onPredVisitanteChange={setPredVisitante}
              loading={loading}
              onSubmit={() => void handleSubmit()}
              onClose={handleClose}
              friendsGoal={status.friendsGoal}
            />
          ) : (
            <SuccessStep
              signupLink={status.signupLink}
              friendsInvited={status.friendsInvited}
              friendsGoal={status.friendsGoal}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      {children}
      {modalOverlay ? createPortal(modalOverlay, document.body) : null}
    </>
  );
}
