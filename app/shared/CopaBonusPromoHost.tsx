"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Gift, Lock, Sparkles, Star, X } from "lucide-react";
import { useAppServerConfig } from "@/app/shared/AppServerConfigContext";
import { useAuth } from "@/app/shared/AuthContext";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import promoGratisBadge from "@/app/assets/promo-gratis-badge.png";
import type { CopaBonusExtraPromoPublicConfig } from "@/lib/promotions/copa-bonus-extra";

const DISMISS_KEY = "bolao_copa_bonus_promo_dismissed";
const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

type PromoConfig = CopaBonusExtraPromoPublicConfig;

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismissedPermanently(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* */
  }
}

/** Pincelada + “GRÁTIS” do mockup (asset fiel ao layout de referência). */
function GratisBrushBadge() {
  return (
    <div className="relative mx-auto mt-3 flex w-full justify-center px-2">
      <Image
        src={promoGratisBadge}
        alt="Grátis"
        width={360}
        height={65}
        className="h-auto w-full max-w-[min(340px,92vw)] object-contain"
        priority
        draggable={false}
      />
    </div>
  );
}

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2.5 14.8 8.2 12 12 9.2 8.2 12 2.5ZM12 21.5 9.2 15.8 12 12l2.8 3.8L12 21.5ZM2.5 12l5.7-2.8L12 12 8.2 14.8 2.5 12ZM21.5 12l-5.7 2.8L12 12l3.8-2.8L21.5 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BenefitColumn({
  icon,
  line1,
  highlight,
  line2,
}: {
  icon: "check" | "star";
  line1: string;
  highlight: string;
  line2: string;
}) {
  const Icon = icon === "check" ? Check : Star;
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-1 text-center">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary shadow-[0_0_20px_rgba(177,235,11,0.35)]"
        aria-hidden
      >
        <Icon className="size-5 text-[#0E141B]" strokeWidth={3} />
      </span>
      <p className="text-[15px] font-semibold leading-snug text-white/90 sm:text-[16px]">
        {line1}{" "}
        <span className="font-black text-primary">{highlight}</span> {line2}
      </p>
    </div>
  );
}

function CopaBonusPromoModal({
  config,
  onClose,
}: {
  config: PromoConfig;
  /** `permanent`: true só se o usuário marcou "não exibir novamente". */
  onClose: (permanent: boolean) => void;
}) {
  const bonusName = config.bonusShortLabel.toUpperCase();
  const principalName = config.principalProductLabel.toUpperCase();
  const bonusLabel = config.bonusShortLabel;
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => onClose(dontShowAgain);
  const footerId = "copa-bonus-promo-footer";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copa-bonus-promo-title"
      aria-describedby={footerId}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[20px] border-2 border-primary bg-black shadow-[0_0_48px_rgba(177,235,11,0.22)]"
        style={{ fontFamily: PROMO_FONT }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-white/90 bg-transparent text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Fechar promoção"
        >
          <X className="size-5" strokeWidth={2.5} aria-hidden />
        </button>

        {/* Cabeçalho */}
        <header className="px-6 pb-4 pt-12 text-center">
          <div className="relative mx-auto mb-2 flex size-[80px] items-center justify-center" aria-hidden>
            
            <Gift
              className="size-16 text-primary"
              strokeWidth={1.6}
              style={{ filter: "drop-shadow(0 0 16px rgba(177,235,11,0.6))" }}
            />
          </div>

          <p className="text-[17px] font-bold uppercase tracking-[0.14em] text-white sm:text-[18px]">
            Você ganhou o
          </p>

          <h2 id="copa-bonus-promo-title" className="mt-1 leading-[1.02] tracking-tight">
            <span className="block text-[30px] font-black uppercase text-white sm:text-[34px]">
              Bolão do
            </span>
            <span
              className="mt-0.5 block text-[30px] font-black uppercase text-primary sm:text-[34px]"
              style={{ textShadow: "0 0 32px rgba(177,235,11,0.4)" }}
            >
              {bonusName}
            </span>
          </h2>

          <GratisBrushBadge />

          <div className="mx-auto mt-5 h-px max-w-[92%] bg-primary/90" aria-hidden />

          <p className="mt-5 text-[16px] font-medium leading-relaxed text-white/90 sm:text-[17px]">
            Na compra da sua cota do
            <br />
            <span className="font-black uppercase text-white">{principalName}</span>
          </p>
        </header>

        {/* Card Brasileirão */}
        <div className="mx-5 mb-5 rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4">
          <div className="flex items-center gap-4">
            <Image
              src={iconBrasileirao}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 object-contain brightness-0 invert"
            />
            <p className="flex flex-1 items-start gap-2 text-left text-[16px] font-medium leading-snug text-white/90 sm:text-[17px]">
              <SoccerBallIcon className="mt-0.5 size-5 shrink-0 text-white/85" />
              <span>
                Faça seus palpites do {bonusLabel}{" "}
                <span className="font-black text-primary">sem pagar nada a mais.</span>
              </span>
            </p>
          </div>
        </div>

        {/* Benefícios */}
        <div className="mx-5 mb-5 grid grid-cols-[1fr_1px_1fr] items-stretch gap-0">
          <BenefitColumn icon="check" line1="Acesso" highlight="liberado" line2="automaticamente" />
          <div className="my-2 w-px bg-white/20" aria-hidden />
          <BenefitColumn icon="star" line1="Promoção" highlight="válida" line2="nesta compra" />
        </div>

        {/* Rodapé: checkbox + CTA */}
        <div className="px-5 pb-6">
          <label className="mb-4 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-left transition-colors hover:border-white/20 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-5 shrink-0 accent-[#B1EB0B]"
            />
            <span className="text-[15px] font-semibold leading-snug text-white/75 sm:text-[16px]">
              Não exibir isso novamente
            </span>
          </label>

          <Link
            href="/tickets"
            onClick={handleClose}
            className="relative flex min-h-[58px] w-full items-center rounded-2xl bg-primary pl-5 pr-4 text-[17px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_8px_36px_rgba(177,235,11,0.4)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[18px]"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0E141B]"
              aria-hidden
            >
              <ArrowRight className="size-5 text-white" strokeWidth={2.8} />
            </span>
            <span className="flex-1 text-center pr-10">Garantir minha cota</span>
          </Link>

          <p
            id={footerId}
            className="mt-4 flex items-start justify-center gap-2 text-center text-[14px] font-medium leading-snug text-white/55 sm:text-[15px]"
          >
            <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>A oferta será liberada após a confirmação da compra.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function CopaBonusPromoHost({ children }: { children: React.ReactNode }) {
  const { ready, isLoggedIn, user } = useAuth();
  const serverConfig = useAppServerConfig();
  const config = serverConfig.copaBonusPromo;
  const [open, setOpen] = useState(false);
  const [hiddenPermanently, setHiddenPermanently] = useState(true);

  const profileBlocksPromo = Boolean(user && user.profileComplete === false);

  useEffect(() => {
    setHiddenPermanently(readDismissed());
  }, []);

  /** Exibe em cada entrada (login / reload) enquanto não marcou "não exibir novamente". */
  useEffect(() => {
    if (!ready || !isLoggedIn || profileBlocksPromo || !config.enabled) {
      setOpen(false);
      return;
    }
    if (readDismissed()) {
      setHiddenPermanently(true);
      setOpen(false);
      return;
    }
    setHiddenPermanently(false);
    setOpen(true);
  }, [ready, isLoggedIn, profileBlocksPromo, user?.id, config.enabled]);

  const close = useCallback((permanent: boolean) => {
    if (permanent) {
      persistDismissedPermanently();
      setHiddenPermanently(true);
    }
    setOpen(false);
  }, []);

  const showModal = open && !hiddenPermanently && config.enabled;

  return (
    <>
      {children}
      {showModal ? <CopaBonusPromoModal config={config} onClose={close} /> : null}
    </>
  );
}
