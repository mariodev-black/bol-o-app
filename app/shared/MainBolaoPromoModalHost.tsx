"use client";

/**
 * Modal promocional — bolão principal (cota geral).
 * Fundo full-bleed: bg-modal-promo.jpeg
 *
 * Abre sob demanda (`useMainBolaoPromoModal`) no fluxo do bolão extra grátis.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Crown, Ticket, Timer, X } from "lucide-react";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import {
  MainBolaoPromoProvider,
  type MainBolaoPromoRequestOptions,
} from "@/app/shared/MainBolaoPromoContext";
import { isMainBolaoPromoModalEnabled } from "@/lib/promotions/main-bolao-promo";
import {
  isMainPromoDebug,
  promoDebugLog,
} from "@/lib/promotions/main-bolao-promo-debug";
import bgModalPromo from "@/app/assets/bg-modal-promo.jpeg";
import logo from "@/app/assets/logo.svg";

const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
/** Após navegar, aguarda antes de exibir o modal. */
const OPEN_AFTER_NAVIGATE_MS = 1000;
const ENTER_MS = 520;
const EXIT_MS = 380;
/** Acima de ExtraGift (110), NavBottom (70), Notifications (140). */
const PROMO_MODAL_Z = 150;

/** Só em memória — sem localStorage/sessionStorage. */
let pendingOpenAfterNav = false;

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
      <Image
        src={bgModalPromo}
        alt=""
        fill
        priority
        className="-z-20 object-cover object-center"
        sizes="(max-width: 380px) 100vw, 380px"
      />
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
            Garantir Minha Participação
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
  const pathname = usePathname();
  const { isLoggedIn, user } = useAuth();
  const isAdminRoute = useIsAdminAppRoute();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string>("idle");
  const openDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const enabled = isMainBolaoPromoModalEnabled();
  const profileBlocks = Boolean(user && user.profileComplete === false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const getBlockReason = useCallback((): string | null => {
    if (!enabled) return "disabled_env";
    if (isAdminRoute) return "admin_route";
    if (!isLoggedIn) return "not_logged_in";
    if (profileBlocks) return "profile_incomplete";
    return null;
  }, [enabled, isAdminRoute, isLoggedIn, profileBlocks]);

  const canOfferModal = useCallback(() => getBlockReason() === null, [getBlockReason]);

  const setDebug = useCallback((status: string, extra?: Record<string, unknown>) => {
    setDebugStatus(status);
    promoDebugLog(status, extra);
  }, []);

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
    setDebug("closed");
  }, [setDebug]);

  const playEnter = useCallback(() => {
    setDebug("showing");
    setVisible(true);
    setActive(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setActive(true));
    });
  }, [setDebug]);

  const scheduleOpenAfterDelay = useCallback(() => {
    const block = getBlockReason();
    if (block) {
      setDebug(`blocked:${block}`, { enabled, pathname });
      return;
    }

    clearTimers();
    closingRef.current = false;
    setActive(false);
    setVisible(false);
    setDebug("scheduled", { delayMs: OPEN_AFTER_NAVIGATE_MS, pathname });

    openDelayRef.current = setTimeout(() => {
      openDelayRef.current = null;
      playEnter();
    }, OPEN_AFTER_NAVIGATE_MS);
  }, [clearTimers, getBlockReason, pathname, playEnter, setDebug, enabled]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimers();
    setActive(false);
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      finishClose();
    }, EXIT_MS);
  }, [clearTimers, finishClose]);

  const requestModal = useCallback(
    (options?: MainBolaoPromoRequestOptions) => {
      const willNavigate = Boolean(options?.navigate);
      setDebug("request", { willNavigate, pathname });

      try {
        options?.navigate?.();
      } catch (err) {
        promoDebugLog("navigate_error", {
          message: err instanceof Error ? err.message : String(err),
        });
      }

      if (!canOfferModal()) return;

      if (willNavigate) {
        pendingOpenAfterNav = true;
        return;
      }

      scheduleOpenAfterDelay();
    },
    [canOfferModal, pathname, scheduleOpenAfterDelay, setDebug],
  );

  useEffect(() => {
    if (!pendingOpenAfterNav) return;
    pendingOpenAfterNav = false;
    setDebug("pending_nav_consumed", { pathname });
    scheduleOpenAfterDelay();
  }, [pathname, scheduleOpenAfterDelay, setDebug]);

  const contextValue = useMemo(() => ({ requestModal }), [requestModal]);

  const overlay =
    visible && portalReady ? (
      <div
        className={[
          "fixed inset-0 flex items-center justify-center p-3 sm:p-4",
          "bg-black/75 backdrop-blur-[2px]",
          "transition-opacity ease-out pointer-events-auto",
          active ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          zIndex: PROMO_MODAL_Z,
          transitionDuration: `${active ? ENTER_MS : EXIT_MS}ms`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="main-bolao-promo-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          className={[
            "w-full max-w-[380px] transition-[opacity,transform] pointer-events-auto",
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
    ) : null;

  return (
    <MainBolaoPromoProvider value={contextValue}>
      {children}
      {portalReady && overlay ? createPortal(overlay, document.body) : null}
      {isMainPromoDebug() ? (
        <div
          className="fixed bottom-20 left-2 max-w-[min(100vw-16px,280px)] rounded-md border border-primary/40 bg-black/90 px-2 py-1 font-mono text-[10px] leading-snug text-primary pointer-events-none"
          style={{ zIndex: PROMO_MODAL_Z + 1 }}
        >
          promo: {debugStatus}
          <br />
          enabled={String(enabled)} z={PROMO_MODAL_Z}
        </div>
      ) : null}
    </MainBolaoPromoProvider>
  );
}
