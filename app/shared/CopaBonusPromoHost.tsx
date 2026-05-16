"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Gift, Lock, Sparkles, Star, X } from "lucide-react";
import { useAppServerConfig } from "@/app/shared/AppServerConfigContext";
import { useAuth } from "@/app/shared/AuthContext";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import type { CopaBonusExtraPromoPublicConfig } from "@/lib/promotions/copa-bonus-extra";

const DISMISS_KEY = "bolao_copa_bonus_promo_dismissed";

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

function CopaBonusPromoModal({
  config,
  onClose,
}: {
  config: PromoConfig;
  /** `permanent`: true só se o usuário marcou "não exibir novamente". */
  onClose: (permanent: boolean) => void;
}) {
  const bonusName = config.bonusShortLabel.toUpperCase();
  const principalName = config.principalProductLabel;
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => onClose(dontShowAgain);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copa-bonus-promo-title"
    >
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-[22px] border border-primary/35 shadow-[0_0_60px_rgba(177,235,11,0.18)]"
        style={{
          background: "linear-gradient(180deg, #141816 0%, #0a0c0a 55%, #050605 100%)",
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>

        <div className="px-5 pb-6 pt-10 text-center">
          <div className="relative mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Gift
              className="size-9 text-primary"
              strokeWidth={1.8}
              style={{ filter: "drop-shadow(0 0 12px rgba(177,235,11,0.55))" }}
            />
            <Sparkles
              className="pointer-events-none absolute -right-1 -top-1 size-4 text-primary/80"
              aria-hidden
            />
          </div>
          <p className="text-[15px] font-bold uppercase tracking-[0.12em] text-white/70 sm:text-[16px]">
            Você ganhou o
          </p>
          <h2
            id="copa-bonus-promo-title"
            className="mt-1 text-[25px] font-black uppercase leading-[1.05] tracking-tight text-primary sm:text-[27px]"
            style={{ textShadow: "0 0 28px rgba(177,235,11,0.35)" }}
          >
            Bolão do {bonusName}
          </h2>
          <p className="mt-2 inline-block rounded-md bg-primary px-3.5 py-1.5 text-[21px] font-black uppercase text-[#0E141B] sm:text-[22px]">
            Grátis
          </p>
          <p className="mt-4 text-[15px] font-medium leading-snug text-white/55 sm:text-[16px]">
            Na compra da sua cota do{" "}
            <span className="font-black uppercase text-white">{principalName}</span>
          </p>
        </div>

        <div className="mx-5 mb-5 rounded-[14px] border border-white/8 bg-[#121412] p-4">
          <div className="flex items-center gap-3">
            <Image
              src={iconBrasileirao}
              alt=""
              width={52}
              height={52}
              className="size-[52px] shrink-0 object-contain"
            />
            <p className="text-left text-[15px] font-medium leading-snug text-white/75 sm:text-[16px]">
              Faça seus palpites do {config.bonusShortLabel}{" "}
              <span className="font-black text-primary">sem pagar nada a mais.</span>
            </p>
          </div>
        </div>

        <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/6 bg-black/30 px-2 py-3 text-center">
            <Check className="size-5 text-primary" strokeWidth={2.5} />
            <span className="text-[11px] font-bold uppercase leading-tight text-white/65 sm:text-[12px]">
              Acesso liberado automaticamente
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/6 bg-black/30 px-2 py-3 text-center">
            <Star className="size-5 text-primary" strokeWidth={2.5} />
            <span className="text-[11px] font-bold uppercase leading-tight text-white/65 sm:text-[12px]">
              Promoção válida nesta compra
            </span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-white/8 bg-black/25 px-3 py-2.5 text-left transition-colors hover:border-white/12">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#B1EB0B]"
            />
            <span className="text-[14px] font-medium leading-snug text-white/55 sm:text-[14px]">
              Não exibir isso novamente
            </span>
          </label>
          <Link
            href="/tickets"
            onClick={handleClose}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[16px] font-black uppercase text-[#0E141B] shadow-[0_8px_32px_rgba(177,235,11,0.35)] transition-transform active:scale-[0.98] sm:text-[17px]"
          >
            Garantir minha cota
            <ArrowRight className="size-4" strokeWidth={2.8} />
          </Link>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] font-medium text-white/40 sm:text-[13px]">
            <Lock className="size-3 shrink-0" strokeWidth={2.2} />
            A oferta será liberada após a confirmação da compra.
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
