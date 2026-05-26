"use client";

/**
 * Modal promocional — bolão principal (cota geral).
 * Fundo full-bleed: bg-modal-promo.jpeg
 *
 * Abre sob demanda (`useMainBolaoPromoModal`) no fluxo do bolão extra grátis.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Crown, Ticket, Timer, X } from "lucide-react";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import {
  MainBolaoPromoProvider,
  type MainBolaoPromoRequestOptions,
} from "@/app/shared/MainBolaoPromoContext";
import {
  isMainBolaoPromoModalAlwaysVisible,
  isMainBolaoPromoModalEnabled,
} from "@/lib/promotions/main-bolao-promo";
import bgModalPromo from "@/app/assets/bg-modal-promo.jpeg";
import logo from "@/app/assets/logo.svg";

const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
/** localStorage — separado de sessionStorage/chaves antigas de teste. */
const DISMISS_STORAGE_KEY = "bolao_milhao_promo_gratis_modal_v2";

function readPromoDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePromoDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
/** Após navegar, aguarda antes de exibir o modal. */
const OPEN_AFTER_NAVIGATE_MS = 1000;
/** Duração da animação de entrada/saída. */
const ENTER_MS = 520;
const EXIT_MS = 380;

/** Título hero — contorno branco leve + sombra para baixo (contraste na foto) */
const PROMO_HERO_WHITE =
  "[paint-order:stroke_fill] [-webkit-text-stroke:0.55px_rgba(255,255,255,0.55)] [text-shadow:0_2px_0_rgba(0,0,0,0.55),0_4px_10px_rgba(0,0,0,0.92),0_8px_24px_rgba(0,0,0,0.75)]";
const PROMO_HERO_PRIMARY =
  "[paint-order:stroke_fill] [-webkit-text-stroke:0.6px_rgba(182,246,0,0.95)] [text-shadow:0_2px_0_rgba(0,0,0,0.6),0_4px_12px_rgba(0,0,0,0.95),0_0_32px_rgba(182,246,0,0.42)]";
const PROMO_SUBLINE_WHITE =
  "[paint-order:stroke_fill] [-webkit-text-stroke:0.4px_rgba(255,255,255,0.4)] [text-shadow:0_2px_6px_rgba(0,0,0,0.9),0_4px_14px_rgba(0,0,0,0.75)]";

function MainBolaoPromoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="relative isolate w-full max-w-[380px] min-h-[min(640px,90dvh)] overflow-hidden rounded-[20px] border border-white/15 shadow-[0_0_40px_rgba(0,0,0,0.45)]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Fundo em toda a área do modal */}
      <Image
        src={bgModalPromo}
        alt=""
        fill
        priority
        className="-z-20 object-cover object-center"
        sizes="(max-width: 380px) 100vw, 380px"
      />
      {/* Header absoluto — logo e fechar sobre o fundo */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-3">
        <Image
          src={logo}
          alt="Bolão do Milhão"
          width={168}
          height={44}
          className="h-9 w-auto shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] min-[380px]:h-10"
          priority
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <X className="size-4" strokeWidth={2.5} aria-hidden />
        </button>
      </header>

      {/* Textos + gradiente só na base (não sobe demais na foto) */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(360px,46dvh)]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 28%, rgba(0,0,0,0.92) 52%, #000000 72%)",
          }}
          aria-hidden
        />
        <div className="relative px-4 pb-5 pt-6">
        <p
          className={`text-center text-[26px] font-black italic uppercase leading-none tracking-tight text-white min-[380px]:text-[28px] ${PROMO_HERO_WHITE}`}
        >
          Entre no
        </p>
        <h2
          id="main-bolao-promo-title"
          className={`mt-1.5 text-center text-[42px] font-black uppercase leading-[0.9] tracking-tight text-white min-[380px]:text-[46px] ${PROMO_HERO_WHITE}`}
        >
          Bolão do
          <br />
          <span
            className={`inline-flex items-center justify-center gap-1.5 text-primary ${PROMO_HERO_PRIMARY}`}
          >
            <Crown
              className="size-8 shrink-0 text-primary drop-shadow-[0_2px_6px_rgba(0,0,0,0.9),0_0_18px_rgba(182,246,0,0.45)] min-[380px]:size-9"
              strokeWidth={2.6}
              aria-hidden
            />
            Milhão
          </span>
        </h2>

        <p
          className={`mt-4 text-center text-[15px] font-black uppercase tracking-wide text-white min-[380px]:text-[16px] ${PROMO_SUBLINE_WHITE}`}
        >
          + de <span className="text-primary">R$1 milhão</span> em premiações
        </p>

        <div className="mx-auto mt-5 flex w-full max-w-[320px] items-center justify-center gap-2.5 rounded-full border border-primary/70 bg-black/50 px-4 py-3 backdrop-blur-sm">
          <Timer className="size-6 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
          <p className="text-center text-[14px] font-black uppercase tracking-wide text-white min-[380px]:text-[15px]">
            Últimas cotas <span className="text-primary">disponíveis!</span>
          </p>
        </div>

        <Link
          href="/tickets?bolao=general"
          onClick={onClose}
          className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[17px] font-black italic uppercase tracking-wide text-[#0a0a0a] shadow-[0_4px_24px_rgba(182,246,0,0.35)] transition-transform active:scale-[0.98] min-[380px]:text-[18px]"
        >
          Garantir minha cota
          <ArrowRight className="size-5 shrink-0 min-[380px]:size-6" strokeWidth={2.8} aria-hidden />
        </Link>

        <p
          className={`mt-4 flex items-center justify-center gap-2 text-center text-[13px] font-bold uppercase tracking-wide text-white min-[380px]:text-[14px] ${PROMO_SUBLINE_WHITE}`}
        >
          <Ticket className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
          Menos de <span className="text-primary">R$0,30</span> por partida
        </p>
        </div>
      </div>
    </div>
  );
}

export function MainBolaoPromoModalHost({ children }: { children: React.ReactNode }) {
  const { ready, isLoggedIn, user } = useAuth();
  const isAdminRoute = useIsAdminAppRoute();
  /** Modal no DOM (permite animar saída antes de desmontar). */
  const [visible, setVisible] = useState(false);
  /** Estado “aberto” da animação (backdrop + card). */
  const [active, setActive] = useState(false);
  const openDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const enabled = isMainBolaoPromoModalEnabled();
  const alwaysVisible = isMainBolaoPromoModalAlwaysVisible();
  const profileBlocks = Boolean(user && user.profileComplete === false);

  const canOfferModal = useCallback(() => {
    if (!enabled || isAdminRoute || !isLoggedIn || profileBlocks) {
      return false;
    }
    if (alwaysVisible) return true;
    return !readPromoDismissed();
  }, [alwaysVisible, enabled, isAdminRoute, isLoggedIn, profileBlocks]);

  const clearTimers = useCallback(() => {
    if (openDelayRef.current != null) {
      clearTimeout(openDelayRef.current);
      openDelayRef.current = null;
    }
    if (exitTimerRef.current != null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
  }, []);

  const playEnter = useCallback(() => {
    setVisible(true);
    setActive(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setActive(true));
    });
  }, []);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimers();
    setActive(false);
    if (!alwaysVisible) {
      writePromoDismissed();
    }
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      finishClose();
    }, EXIT_MS);
  }, [alwaysVisible, clearTimers, finishClose]);

  const scheduleModal = useCallback(() => {
    if (!canOfferModal()) return;

    clearTimers();
    closingRef.current = false;
    setActive(false);
    setVisible(false);

    openDelayRef.current = setTimeout(() => {
      openDelayRef.current = null;
      playEnter();
    }, OPEN_AFTER_NAVIGATE_MS);
  }, [canOfferModal, clearTimers, playEnter]);

  const requestModal = useCallback(
    (options?: MainBolaoPromoRequestOptions) => {
      try {
        options?.navigate?.();
      } catch {
        /* navegação não deve bloquear o modal */
      }
      scheduleModal();
    },
    [scheduleModal],
  );

  const contextValue = useMemo(
    () => ({ requestModal }),
    [requestModal],
  );

  return (
    <MainBolaoPromoProvider value={contextValue}>
      {children}
      {visible ? (
        <div
          className={[
            "fixed inset-0 z-115 flex items-center justify-center p-3 sm:p-4",
            "bg-black/75 backdrop-blur-[2px]",
            "transition-opacity ease-out",
            active ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ transitionDuration: `${active ? ENTER_MS : EXIT_MS}ms` }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="main-bolao-promo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className={[
              "w-full max-w-[380px] transition-[opacity,transform]",
              active
                ? "scale-100 translate-y-0 opacity-100 ease-out"
                : "scale-[0.92] translate-y-5 opacity-0 ease-in",
            ].join(" ")}
            style={{
              transitionDuration: `${active ? ENTER_MS : EXIT_MS}ms`,
              transitionTimingFunction: active
                ? "cubic-bezier(0.22, 1, 0.36, 1)"
                : "cubic-bezier(0.4, 0, 0.6, 1)",
            }}
          >
            <MainBolaoPromoModal onClose={handleClose} />
          </div>
        </div>
      ) : null}
    </MainBolaoPromoProvider>
  );
}
