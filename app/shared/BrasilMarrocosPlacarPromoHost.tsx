"use client";

/**
 * Promo "Acerte o placar exato — Amistoso Brasil x Marrocos".
 * Step 1: palpite no modal
 * Step 2: ativação em /promo-camisa-brasil (compra da cota)
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Link2,
  Shirt,
  ShoppingCart,
  Ticket,
  User,
  X,
} from "lucide-react";
import camisaBraImg from "@/app/assets/camisa-nova-bra.png";
import dinheiroImg from "@/app/assets/pix-banco-central.svg";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import { useBolaoToast } from "@/app/components/BolaoToast";
import {
  fetchBrasilMarrocosPlacarPromoStatus,
  peekBrasilMarrocosPlacarPromoStatus,
  seedBrasilMarrocosPlacarPromoStatus,
} from "@/app/shared/useBrasilMarrocosPlacarPromoStatus";
import { useRegisterPromotionHub, usePromotionsHub } from "@/app/shared/PromotionsHubContext";
import {
  isMeaningfulBrasilMarrocosPlacarSubmission,
  isPromoCheckoutPath,
  PROMO_ACTIVATION_PATH,
  type BrasilMarrocosPlacarPromoStatus,
} from "@/lib/promotions/brasil-marrocos-placar-promo-shared";
import { resolveNationalTeamShieldUrl } from "@/lib/football/national-team-shields";
import brasilLogo from "@/app/assets/brasil-selecao-logo.png";

const MARROCOS_SHIELD_URL =
  resolveNationalTeamShieldUrl("Marrocos") ??
  "https://cdn.api-futebol.com.br/times/escudos/677fca6889a75.svg";

const PROMO_FONT =
  "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
const GREEN = "#B1EB0B";
const PROMO_SURFACE = "#141414";
const PROMO_CARD = "#121212";
const PROMO_CARD_ALT = "#1a1a1a";
const PROMO_BORDER = "rgba(255,255,255,0.12)";
const PROMO_Z = 156;

function formatPromoPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
const OPEN_DELAY_MS = 0;
const API_PATH = "/api/promotions/brasil-marrocos-placar";

type Step = "offer" | "unavailable";


function PromoHeroShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-full max-w-[390px]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
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
          label="gols do Marrocos"
        />

        <TeamLogoRemote
          src={MARROCOS_SHIELD_URL}
          alt="Marrocos"
          className="size-16 shrink-0 object-contain"
        />
      </div>
    </div>
  );
}

function PlacarExatoSummary({
  predCasa,
  predVisitante,
}: {
  predCasa: number;
  predVisitante: number;
}) {
  return (
    <div className="mt-2 rounded-2xl bg-[#1a1a1a] px-2 py-2">
      <p className="text-center text-[11px] font-black uppercase tracking-[0.14em] text-white/55 sm:text-[12px]">
        Seu palpite
      </p>

      <div className="mt-0 flex items-center justify-between gap-1">
        <TeamLogo src={brasilLogo} alt="Brasil" />

        <div className="flex flex-col items-center">
          <span
            className="min-w-[42px] text-center text-[44px] font-black tabular-nums leading-none text-white/90 sm:text-[48px]"
            aria-label={`${predCasa} gols do Brasil`}
          >
            {predCasa}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase text-white/45 sm:text-[12px]">
            BRASIL
          </span>
        </div>

        <span
          className="shrink-0 px-1 text-[20px] font-bold text-white/45"
          aria-hidden
        >
          x
        </span>

        <div className="flex flex-col items-center">
          <span
            className="min-w-[42px] text-center text-[44px] font-black tabular-nums leading-none text-white/90 sm:text-[48px]"
            aria-label={`${predVisitante} gols do Marrocos`}
          >
            {predVisitante}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase text-white/45 sm:text-[12px]">
            MARROCOS
          </span>
        </div>

        <TeamLogoRemote
          src={MARROCOS_SHIELD_URL}
          alt="Marrocos"
          className="size-16 shrink-0 object-contain"
        />
      </div>
    </div>
  );
}

function EscanteiosPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-3">
      <p className="text-center text-[12px] font-bold leading-snug text-white">
        Quantos escanteios o Brasil terá na partida?
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <TeamLogo
          src={brasilLogo}
          alt="Brasil"
          className="size-8 shrink-0 object-contain"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
            className="flex size-7 items-center justify-center rounded-md bg-[#2a2a2a] ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
            aria-label="Diminuir escanteios"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} style={{ color: GREEN }} />
          </button>
          <span className="min-w-[28px] text-center text-[26px] font-black tabular-nums leading-none text-white/90">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(99, value + 1))}
            className="flex size-7 items-center justify-center rounded-md bg-[#2a2a2a] ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
            aria-label="Aumentar escanteios"
          >
            <ChevronRight className="size-4" strokeWidth={2.5} style={{ color: GREEN }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SignupPromptModal({
  onCreateAccount,
}: {
  onCreateAccount: () => void;
}) {
  return (
    <div
      className="relative w-full max-w-[340px] rounded-4xl border border-white/8 bg-[#141414] px-5 pb-6 pt-8 shadow-[0_24px_48px_rgba(0,0,0,0.65)]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center" id="brasil-marrocos-signup-prompt-title">
        <p className="text-[20px] font-black leading-snug text-white">
          Falta apenas 1 passo para validar sua participação na promoção.
        </p>
      </div>

      <button
        type="button"
        onClick={onCreateAccount}
        className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-full bg-primary px-5 text-[14px] font-black uppercase italic tracking-wide text-[#0E141B] transition active:scale-[0.98]"
      >
        Continuar Cadastro
      </button>
    </div>
  );
}

export function OfferStep({
  predCasa,
  predVisitante,
  predEscanteios,
  onPredCasaChange,
  onPredVisitanteChange,
  onPredEscanteiosChange,
  loading,
  onSubmit,
  onClose,
}: {
  predCasa: number;
  predVisitante: number;
  predEscanteios: number;
  onPredCasaChange: (n: number) => void;
  onPredVisitanteChange: (n: number) => void;
  onPredEscanteiosChange: (n: number) => void;
  loading: boolean;
  onSubmit: () => void;
  onClose: () => void;
  friendsGoal: number;
}) {
  const canSubmit = isMeaningfulBrasilMarrocosPlacarSubmission(
    predCasa,
    predVisitante,
  );

  return (
    <PromoHeroShell onClose={onClose}>
      {/* Header */}
      <div id="brasil-marrocos-placar-promo-title" className="text-center">
        <p className="text-[16px] font-black uppercase leading-none tracking-wide text-white">
          Acerte o
        </p>
        <p
          className="mt-0.5 text-[38px] font-black italic uppercase leading-[0.88] tracking-tight"
          style={{ color: GREEN }}
        >
          Placar exato
        </p>
        <p className="mt-1.5 text-[18px] font-black uppercase leading-none tracking-wide text-white">
          Brasil{" "}
          <span style={{ color: GREEN }}>x</span>
          {" "}Marrocos
        </p>
      </div>

      {/* Prize box */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
        <div className="flex items-start gap-2 px-3 pb-1 pt-2.5">
          <span className="text-[16px] leading-none" aria-hidden>🏆</span>
          <p className="text-[11px] font-semibold leading-snug text-white">
            Acerte o{" "}
            <span className="font-bold" style={{ color: GREEN }}>placar exato</span>
            {" "}+ os{" "}
            <span className="font-bold" style={{ color: GREEN }}>escanteios do Brasil</span>
            {" "}e ganhe:
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/10 px-2 pb-3">
          <div className="flex flex-col items-center gap-0.5 pr-2 pt-1">
            <Image
              src={camisaBraImg}
              alt="Camisa oficial da Seleção Brasileira"
              width={90}
              height={80}
              className="object-contain"
              draggable={false}
            />
            <p className="text-[12px] font-black uppercase italic leading-tight" style={{ color: GREEN }}>
              Camisa Oficial
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white">
              da Seleção Brasileira
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5 pl-2 pt-1">
            <Image
              src={dinheiroImg}
              alt="R$ 1.000 no PIX"
              width={120}
              height={120}
              className="object-contain"
              draggable={false}
            />
            <p className="text-[20px] font-black uppercase italic leading-tight" style={{ color: GREEN }}>
              R$ 1.000
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-white">
              no PIX
            </p>
          </div>
        </div>
      </div>

      {/* Score picker */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-3">
        <p className="text-center text-[12px] font-bold uppercase tracking-wide text-white">
          Qual é o placar exato do jogo?
        </p>
        <div className="mt-3 flex items-center justify-between gap-1">
          <div className="flex flex-col items-center gap-0.5">
            <Image
              src={brasilLogo}
              alt="Brasil"
              width={44}
              height={44}
              className="size-11 object-contain"
              draggable={false}
            />
            <span className="text-[9px] font-black uppercase tracking-wide text-white/70">Brasil</span>
          </div>

          <ScoreStepperColumn value={predCasa} onChange={onPredCasaChange} label="gols do Brasil" />

          <span className="shrink-0 px-1 text-[20px] font-bold text-white/45" aria-hidden>x</span>

          <ScoreStepperColumn value={predVisitante} onChange={onPredVisitanteChange} label="gols do Marrocos" />

          <div className="flex flex-col items-center gap-0.5">
            <Image
              src={MARROCOS_SHIELD_URL}
              alt="Marrocos"
              width={44}
              height={44}
              unoptimized
              className="size-11 object-contain"
              draggable={false}
            />
            <span className="text-[9px] font-black uppercase tracking-wide text-white/70">Marrocos</span>
          </div>
        </div>
      </div>

      {/* Escanteios picker */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3 py-3">
        <p className="text-center text-[12px] font-bold uppercase tracking-wide text-white">
          Quantos escanteios o Brasil terá na partida?
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <Image
            src={brasilLogo}
            alt="Brasil"
            width={28}
            height={28}
            className="size-7 object-contain"
            draggable={false}
          />
          <button
            type="button"
            onClick={() => onPredEscanteiosChange(Math.max(0, predEscanteios - 1))}
            className="flex size-9 items-center justify-center rounded-lg bg-[#2a2a2a] text-[22px] font-bold leading-none text-white/80 ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
            aria-label="Diminuir escanteios"
          >
            −
          </button>
          <span className="min-w-[32px] text-center text-[28px] font-black tabular-nums leading-none text-white">
            {predEscanteios}
          </span>
          <button
            type="button"
            onClick={() => onPredEscanteiosChange(Math.min(99, predEscanteios + 1))}
            className="flex size-9 items-center justify-center rounded-lg bg-[#2a2a2a] text-[22px] font-bold leading-none text-white/80 ring-1 ring-white/8 transition hover:bg-[#333] active:scale-95"
            aria-label="Aumentar escanteios"
          >
            +
          </button>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        disabled={loading || !canSubmit}
        onClick={onSubmit}
        className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-full bg-primary px-5 text-[14px] font-black uppercase italic tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-60"
      >
        <Check className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="flex-1 text-center">
          {loading ? "Salvando..." : "Registrar Palpite"}
        </span>
        <ArrowRight className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
      </button>

      {/* Footer */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-center gap-1.5">
          <svg className="size-3 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-[10px] font-medium text-white/45">
            Os palpites encerram antes do início da partida.
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <svg className="size-3 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-center text-[10px] font-medium text-white/45">
            Promoção exclusiva para participantes do{" "}
            <span className="font-bold text-white/70">Bolão do Milhão</span>{" "}
            com{" "}
            <span className="font-bold" style={{ color: GREEN }}>cota ativa</span>.
          </p>
        </div>
      </div>
    </PromoHeroShell>
  );
}

export function UnavailableStep({
  onClose,
  friendsGoal,
}: {
  onClose: () => void;
  friendsGoal: number;
}) {
  return (
    <PromoHeroShell onClose={onClose}>
      <div id="brasil-marrocos-placar-unavailable-title" className="text-center">
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
          Brasil x Marrocos
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

      <div className="mt-5 rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4 text-center">
        <p className="text-[13px] font-bold leading-snug text-white/90">
          Você já palpitou neste jogo no bolão.
        </p>
        <p className="mt-2 text-[12px] font-medium leading-snug text-white/55">
          Esta promoção é exclusiva para quem ainda não fez palpite no amistoso
          Brasil x Marrocos. Convide {friendsGoal} amigos em outras promoções para
          concorrer a prêmios.
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-primary px-5 text-[14px] font-black uppercase italic tracking-wide text-[#0E141B] transition active:scale-[0.98]"
      >
        Entendi
      </button>
    </PromoHeroShell>
  );
}

export function SuccessStep({
  predCasa,
  predVisitante,
  signupLink,
  friendsInvited,
  friendsGoal,
  onClose,
}: {
  predCasa: number;
  predVisitante: number;
  signupLink: string;
  friendsInvited: number;
  friendsGoal: number;
  onClose: () => void;
}) {
  const toast = useBolaoToast();
  const [copied, setCopied] = useState(false);
  const ticketPriceLabel = formatPromoPriceBRL(2990);
  const filled = Math.min(friendsGoal, Math.max(0, friendsInvited));

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

  return (
    <div
      className="relative w-full max-w-[520px] rounded-4xl border px-4 pb-4 pt-4 shadow-[0_24px_48px_rgba(0,0,0,0.65)] sm:px-6"
      style={{
        fontFamily: PROMO_FONT,
        background: PROMO_SURFACE,
        borderColor: PROMO_BORDER,
      }}
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

      <div className="text-center" id="brasil-marrocos-placar-success-title">
        <div
          className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full"
        >
          <Check className="size-6 text-primary" strokeWidth={2.5} />
        </div>
        <p className="text-[22px] font-black italic uppercase leading-tight text-white sm:text-[26px]">
          Palpite{" "}
          <span style={{ color: GREEN }}>registrado!</span>
        </p>

        <PlacarExatoSummary predCasa={predCasa} predVisitante={predVisitante} />
      </div>

      <div
        className="mt-0 flex items-center gap-4 sm:gap-5"
      >
        <div className="relative h-[128px] w-[88px] shrink-0 sm:h-[140px] sm:w-[96px]">
          <Image
            src={camisaBraImg}
            alt="Camisa oficial da Seleção Brasileira modelo 2026"
            fill
            className="object-contain object-left"
            sizes="96px"
            draggable={false}
            priority
          />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[12px] font-black uppercase leading-tight tracking-wide text-white/85 sm:text-[13px]">
            Concorra à
          </p>
          <p
            className="text-[19px] font-black uppercase leading-tight tracking-wide sm:text-[22px]"
            style={{ color: GREEN }}
          >
            Camisa oficial
          </p>
          <p className="text-[12px] font-black uppercase leading-tight tracking-wide text-white/85 sm:text-[13px]">
            da Seleção Brasileira
          </p>
          <p
            className="mt-0.5 text-[13px] font-black uppercase tracking-wide sm:text-[14px]"
            style={{ color: GREEN }}
          >
            Modelo 2026
          </p>
        </div>
      </div>

      <div className="relative mt-2 mb-1">
        <div className="border-t" style={{ borderColor: PROMO_BORDER }} aria-hidden />
        <span
          className="absolute left-1/2 top-0 whitespace-nowrap -translate-x-1/2 -translate-y-1/2 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/50 sm:text-[12px]"
          style={{ background: PROMO_SURFACE }}
        >
          Escolha como participar
        </span>
      </div>

      <div className="relative mt-2 grid grid-cols-2 items-stretch gap-3">
        <span
          className="pointer-events-none absolute left-1/2 top-[44%] z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[10px] font-black uppercase text-white/60"
          style={{ background: PROMO_SURFACE, borderColor: PROMO_BORDER }}
          aria-hidden
        >
          ou
        </span>

        {/* Opção 1 — comprar cota (borda verde) */}
        <div
          className="flex flex-col rounded-2xl border-2 p-2"
          style={{ background: PROMO_CARD, borderColor: `${GREEN}99` }}
        >
          <div className="flex flex-1 flex-col">
            <span
              className="mx-auto rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#0E141B]"
              style={{ background: GREEN }}
            >
              Opção 1
            </span>
            <p className="mt-3 text-center text-[14px] font-black uppercase leading-tight text-white">
              Garantir agora
            </p>
            <p
              className="mt-2.5 text-center text-[13px] font-black uppercase leading-snug tracking-tight"
              style={{ color: GREEN }}
            >
              + de R$ 1 milhão em premiações
            </p>
            <p className="mt-3 text-center text-[12px] font-semibold leading-snug text-white/75 sm:text-[13px]">
              Por apenas{" "}
              <span className="font-black" style={{ color: GREEN }}>
                {ticketPriceLabel}
              </span>
            </p>
            <ul className="mt-3 space-y-2 text-[11px] font-semibold leading-snug text-white/70 sm:text-[12px]">
              <li className="flex items-start justify-center gap-1.5 text-center">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={3} />
                Copa inteira
              </li>
            </ul>
          </div>
          <Link
            href="/tickets"
            onClick={onClose}
            className="mt-4 flex min-h-[52px] w-full shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-2 py-2 text-[#0E141B] transition active:scale-[0.98]"
          >
            <ShoppingCart
              className="size-3.5 shrink-0 self-center"
              strokeWidth={2.4}
            />
            <span className="text-center text-[10px] font-black uppercase italic leading-[1.15] tracking-tight">
              Garantir
              <span className="block">minha cota</span>
            </span>
          </Link>
        </div>

        {/* Opção 2 — indicar amigos (card dark, sem amarelo) */}
        <div
          className="flex flex-col rounded-2xl border-2 p-2"
          style={{ background: PROMO_CARD, borderColor: PROMO_BORDER }}
        >
          <div className="flex flex-1 flex-col">
            <span
              className="mx-auto rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white/75"
              style={{ background: PROMO_CARD_ALT }}
            >
              Opção 2
            </span>
            <p className="mt-3 text-center text-[14px] font-black uppercase leading-tight text-white">
              Participar grátis
            </p>
            <p className="mt-2.5 text-center text-[13px] font-bold leading-snug text-white/85">
              Convide{" "}
              <span style={{ color: GREEN }}>{friendsGoal}</span> amigos
            </p>


            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: friendsGoal }, (_, i) => {
                const active = i < filled;
                return (
                  <span
                    key={i}
                    className="flex size-9 items-center justify-center rounded-full border sm:size-10"
                    style={{
                      borderColor: active ? `${GREEN}55` : PROMO_BORDER,
                      background: active ? `${GREEN}14` : PROMO_CARD_ALT,
                      color: active ? GREEN : "rgba(255,255,255,0.32)",
                    }}
                  >
                    <User className="size-4 sm:size-[18px]" strokeWidth={2} />
                  </span>
                );
              })}
            </div>
            <p className="mt-2.5 text-center text-[12px] font-semibold text-white/45 sm:text-[13px]">
              {friendsInvited}/{friendsGoal} amigos convidados
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="mt-4 flex min-h-[52px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-black uppercase italic leading-none tracking-tight text-[#0E141B] transition active:scale-[0.98]"
          >
            <Link2 className="size-3.5 shrink-0" strokeWidth={2.4} />
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BrasilMarrocosPlacarPromoHost({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, isLoggedIn, user } = useAuth();
  const toast = useBolaoToast();
  const { getPromotionPrefetch, setPromotionPrefetch, invalidatePromotionsHub } =
    usePromotionsHub();
  const isAdminRoute = useIsAdminAppRoute();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [status, setStatus] = useState<BrasilMarrocosPlacarPromoStatus | null>(
    () => peekBrasilMarrocosPlacarPromoStatus(),
  );
  const [predCasa, setPredCasa] = useState(0);
  const [predVisitante, setPredVisitante] = useState(0);
  const [predEscanteios, setPredEscanteios] = useState(0);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const profileBlocksPromo = Boolean(user && user.profileComplete === false);

  const goToPromoActivation = useCallback(() => {
    if (isPromoCheckoutPath(pathname)) return;
    setOpen(false);
    if (pathname !== PROMO_ACTIVATION_PATH) {
      router.push(PROMO_ACTIVATION_PATH);
    }
  }, [pathname, router]);

  const refreshStatus =
    useCallback(async (): Promise<BrasilMarrocosPlacarPromoStatus | null> => {
      const data = await fetchBrasilMarrocosPlacarPromoStatus();
      if (data) {
        setPromotionPrefetch("brasil_marrocos_placar", data);
        setStatus(data);
      }
      return data;
    }, [setPromotionPrefetch]);

  const applyHubOpen = useCallback(
    (
      data: BrasilMarrocosPlacarPromoStatus,
      options?: { manual?: boolean },
    ) => {
      setStatus(data);
      if (data.showOfferModal) {
        if (
          !options?.manual &&
          (pathname === "/" || pathname === "/homepage")
        ) {
          return;
        }
        setStep("offer");
        setPredCasa(0);
        setPredVisitante(0);
        setPredEscanteios(0);
        setOpen(true);
        return;
      }
      if (data.needsQuotaPurchase) {
        // Não redirecionar automaticamente — só após salvar palpite ou clique explícito (card/hub).
        return;
      }
      if (data.promoActivated || data.alreadySubmitted) {
        return;
      }
      if (data.hasBet && options?.manual) {
        setStep("unavailable");
        setOpen(true);
      }
    },
    [pathname],
  );

  const openFromPromotionsHub = useCallback(() => {
    const cached =
      status ??
      (getPromotionPrefetch("brasil_marrocos_placar") as
        | BrasilMarrocosPlacarPromoStatus
        | undefined);
    if (cached?.enabled) {
      applyHubOpen(cached, { manual: true });
    }
    void refreshStatus().then((fresh) => {
      if (!fresh?.enabled) return;
      if (!cached?.enabled) {
        applyHubOpen(fresh, { manual: true });
        return;
      }
      setStatus(fresh);
      if (fresh.needsQuotaPurchase) {
        if (isPromoCheckoutPath(pathname) || pathname === PROMO_ACTIVATION_PATH) {
          return;
        }
        goToPromoActivation();
        return;
      }
      if (fresh.promoActivated) {
        return;
      }
      if (fresh.hasBet) {
        setStep("unavailable");
        setOpen(true);
      }
    });
  }, [status, getPromotionPrefetch, applyHubOpen, refreshStatus, goToPromoActivation, pathname]);

  useRegisterPromotionHub("brasil_marrocos_placar", openFromPromotionsHub);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onPromoFlowRoute =
      isPromoCheckoutPath(pathname) || pathname === PROMO_ACTIVATION_PATH;

    if (
      isAdminRoute ||
      !ready ||
      !isLoggedIn ||
      profileBlocksPromo ||
      !user?.id
    ) {
      setOpen(false);
      if (!onPromoFlowRoute) setStatus(null);
      return;
    }

    if (onPromoFlowRoute) {
      const cached =
        peekBrasilMarrocosPlacarPromoStatus() ??
        (getPromotionPrefetch("brasil_marrocos_placar") as
          | BrasilMarrocosPlacarPromoStatus
          | undefined);
      if (cached) setStatus(cached);
      return;
    }

    const run = async () => {
      try {
        const data = await refreshStatus();
        if (cancelled) return;
        if (!data?.enabled) {
          setStatus(data);
          setOpen(false);
          return;
        }
        applyHubOpen(data);
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
    pathname,
    getPromotionPrefetch,
    refreshStatus,
    applyHubOpen,
  ]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    if (!isMeaningfulBrasilMarrocosPlacarSubmission(predCasa, predVisitante)) {
      toast.error("Informe o placar exato antes de registrar.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(API_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ predCasa, predVisitante, escanteiosBrasil: predEscanteios }),
      });
      const data = (await r
        .json()
        .catch(() => ({}))) as BrasilMarrocosPlacarPromoStatus & {
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error ?? "Não foi possível salvar o palpite.");
        return;
      }
      setStatus(data);
      seedBrasilMarrocosPlacarPromoStatus(data);
      setPromotionPrefetch("brasil_marrocos_placar", data);
      invalidatePromotionsHub();
      goToPromoActivation();
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [predCasa, predVisitante, predEscanteios, toast, invalidatePromotionsHub, goToPromoActivation]);

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
            ? "brasil-marrocos-placar-promo-title"
            : "brasil-marrocos-placar-unavailable-title"
        }
        onClick={handleClose}
      >
        <div className="my-auto flex w-full justify-center py-2">
          {step === "offer" ? (
            <OfferStep
              predCasa={predCasa}
              predVisitante={predVisitante}
              predEscanteios={predEscanteios}
              onPredCasaChange={setPredCasa}
              onPredVisitanteChange={setPredVisitante}
              onPredEscanteiosChange={setPredEscanteios}
              loading={loading}
              onSubmit={() => void handleSubmit()}
              onClose={handleClose}
              friendsGoal={status.friendsGoal}
            />
          ) : (
            <UnavailableStep
              onClose={handleClose}
              friendsGoal={status.friendsGoal}
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
