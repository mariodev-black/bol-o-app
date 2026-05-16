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
    <div className="relative mx-auto mt-2 flex w-full justify-center px-2">
      <Image
        src={promoGratisBadge}
        alt="Grátis"
        width={360}
        height={65}
        className="h-auto w-full max-w-[min(260px,78vw)] object-contain"
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
    <div className="flex flex-col items-center gap-2 px-1.5 py-0.5 text-center">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary ring-2 ring-primary/25"
        aria-hidden
      >
        <Icon className="size-4 text-[#0E141B]" strokeWidth={2.8} />
      </span>
      <p className="text-[12px] font-semibold leading-snug text-white/85 sm:text-[13px]">
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
        className="relative w-full max-w-[390px] overflow-hidden rounded-[18px] border-2 border-primary bg-black shadow-[0_0_40px_rgba(177,235,11,0.2)]"
        style={{ fontFamily: PROMO_FONT }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex size-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/70 bg-black/40 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Fechar promoção"
        >
          <X className="size-4" strokeWidth={2.5} aria-hidden />
        </button>

        {/* Cabeçalho */}
        <header className="px-5 pb-3 pt-10 text-center">
          <div
            className="relative mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/8"
            aria-hidden
          >
            <Gift
              className="size-8 text-primary"
              strokeWidth={1.7}
              style={{ filter: "drop-shadow(0 0 10px rgba(177,235,11,0.45))" }}
            />
            <Sparkles className="absolute -right-0.5 -top-0.5 size-3.5 text-primary/90" />
            <span className="absolute -left-1 top-3 h-4 w-px rotate-[-28deg] rounded-full bg-primary/50" />
            <span className="absolute -right-1 bottom-3 h-3 w-px rotate-[18deg] rounded-full bg-primary/40" />
          </div>

          <p className="text-[14px] font-bold uppercase tracking-[0.12em] text-white/90">
            Você ganhou o
          </p>

          <h2 id="copa-bonus-promo-title" className="mt-0.5 leading-[1.05] tracking-tight">
            <span className="block text-[24px] font-black uppercase text-white sm:text-[26px]">
              Bolão do
            </span>
            <span
              className="mt-0.5 block text-[24px] font-black uppercase text-primary sm:text-[26px]"
              style={{ textShadow: "0 0 24px rgba(177,235,11,0.35)" }}
            >
              {bonusName}
            </span>
          </h2>

          <GratisBrushBadge />

          <div className="mx-auto mt-4 h-px max-w-[88%] bg-primary/80" aria-hidden />

          <p className="mt-3.5 text-[14px] font-medium leading-relaxed text-white/85 sm:text-[15px]">
            Na compra da sua cota do
            <br />
            <span className="font-black uppercase text-white">{principalName}</span>
          </p>
        </header>

        {/* Card Brasileirão */}
        <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-[#1a1a1a] px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex shrink-0 items-center gap-2 rounded-lg border border-white/8 bg-black/35 px-2 py-1.5"
              aria-hidden
            >
              <Image
                src={iconBrasileirao}
                alt=""
                width={48}
                height={48}
                className="size-11 object-contain brightness-0 invert"
              />
              <span className="h-8 w-px bg-white/15" />
              <SoccerBallIcon className="size-5 text-white/80" />
            </div>
            <p className="flex-1 text-left text-[14px] font-medium leading-snug text-white/88 sm:text-[15px]">
              Faça seus palpites do {bonusLabel}{" "}
              <span className="font-black text-primary">sem pagar nada a mais.</span>
            </p>
          </div>
        </div>

        {/* Rodapé: checkbox + CTA */}
        <div className="px-4 pb-5">
          <label className="mb-3 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-white/12 bg-white/4 px-3 py-2.5 text-left transition-colors hover:border-white/20 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-4 shrink-0 accent-[#B1EB0B]"
            />
            <span className="text-[13px] font-semibold leading-snug text-white/75 sm:text-[14px]">
              Não exibir isso novamente
            </span>
          </label>

          <Link
            href="/tickets"
            onClick={handleClose}
            className="relative flex min-h-[52px] w-full items-center rounded-xl bg-primary pl-4 pr-3 text-[15px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_6px_28px_rgba(177,235,11,0.35)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[16px]"
          >
            
            <span className="flex-1 text-center pr-9">Garantir minha cota</span>
          </Link>

          <p
            id={footerId}
            className="mt-3 flex items-start justify-center gap-1.5 text-center text-[12px] font-medium leading-snug text-white/55 sm:text-[13px]"
          >
            <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
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
