"use client";

/**
 * Popup na home — bolão diário de hoje.
 * Exibe uma vez por dia para usuários logados com cadastro completo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import logoBolaoDiario from "@/app/assets/logo-bolao-diario.png";
import logo from "@/app/assets/logo.svg";
import {
  DAILY_BOLAO_HOME_PROMO_TICKETS_HREF,
  isDailyBolaoHomePromoEnabled,
  persistDailyBolaoHomePromoDismissed,
  readDailyBolaoHomePromoDismissed,
} from "@/lib/promotions/daily-bolao-home-promo";

const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
const OPEN_DELAY_MS = 800;
const ENTER_MS = 420;
const EXIT_MS = 320;
const PROMO_MODAL_Z = 151;

function isHomePath(pathname: string): boolean {
  const path = pathname.trim();
  return path === "" || path === "/";
}

function DailyBolaoHomePromoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="relative w-full max-w-[380px] overflow-hidden rounded-[22px] border border-white/12 bg-[#0a0a0a]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar promoção"
        className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full border border-white/12 bg-[#141414] text-white/80 transition-colors hover:border-white/25 hover:text-white"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="relative px-5 pb-5 pt-5">
        <header className="mb-4 pr-8">
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={150}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </header>

        <div className="mx-auto mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-[18px] border border-white/12 bg-[#111111] p-2.5">
          <Image
            src={logoBolaoDiario}
            alt="Bolão Diário"
            width={72}
            height={72}
            className="h-auto w-full object-contain"
          />
        </div>

        <p className="text-center text-[12px] font-black uppercase tracking-[0.16em] text-primary">
          🚨 Bolão de hoje liberado
        </p>

        <h2
          id="daily-bolao-home-promo-title"
          className="mt-2 text-center text-[26px] font-black uppercase leading-[1.05] tracking-tight text-white"
        >
          Dispute o bolão
          <br />
          <span className="text-primary">do dia</span>
        </h2>

        <ul className="mt-4 space-y-2.5">
          {[
            {
              icon: "💰",
              text: (
                <>
                  <span className="font-black text-primary">R$10</span> para disputar mais de{" "}
                  <span className="font-black text-primary">R$1.000</span> em premiações.
                </>
              ),
            },
            {
              icon: "🏆",
              text: "Os 10 melhores colocados ganham.",
            },
            {
              icon: "⏳",
              text: "Inscrições encerram antes do início dos jogos.",
            },
          ].map((item) => (
            <li
              key={item.icon}
              className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-[#111111] px-3.5 py-3"
            >
              <span className="text-[17px] leading-none" aria-hidden>
                {item.icon}
              </span>
              <p className="min-w-0 text-left text-[14px] font-semibold leading-snug text-white/88">
                {item.text}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
          Top 10 premiados · <span className="text-primary">100%</span> da arrecadação
        </p>

        <Link
          href={DAILY_BOLAO_HOME_PROMO_TICKETS_HREF}
          onClick={onClose}
          className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-full bg-primary px-5 text-[15px] font-black uppercase tracking-[0.06em] text-[#0a0a0a] transition-transform active:scale-[0.98]"
        >
          Quero participar
          <ArrowRight className="size-5 shrink-0" strokeWidth={3} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function DailyBolaoHomePromoHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, isLoggedIn, user } = useAuth();
  const isAdminRoute = useIsAdminAppRoute();
  const enabled = isDailyBolaoHomePromoEnabled();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const openedRef = useRef(false);

  const profileBlocks = Boolean(user && user.profileComplete === false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const dismiss = useCallback(() => {
    persistDailyBolaoHomePromoDismissed(user?.id);
  }, [user?.id]);

  const playEnter = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setVisible(true);
    setActive(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setActive(true));
    });
  }, []);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    dismiss();
    if (exitTimerRef.current != null) clearTimeout(exitTimerRef.current);
    setActive(false);
    exitTimerRef.current = setTimeout(() => {
      setVisible(false);
      closingRef.current = false;
    }, EXIT_MS);
  }, [dismiss]);

  useEffect(() => {
    openedRef.current = false;

    if (!enabled) return;
    if (!ready) return;
    if (!isHomePath(pathname)) return;
    if (isAdminRoute) return;
    if (!isLoggedIn) return;
    if (profileBlocks) return;
    if (readDailyBolaoHomePromoDismissed(user?.id)) return;

    const timer = window.setTimeout(() => {
      playEnter();
    }, OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    isAdminRoute,
    isLoggedIn,
    pathname,
    playEnter,
    profileBlocks,
    ready,
    user?.id,
  ]);

  useEffect(
    () => () => {
      if (exitTimerRef.current != null) clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const overlay =
    visible && portalReady ? (
      <div
        className={[
          "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain p-4",
          "bg-black/82",
          "transition-opacity ease-out pointer-events-auto",
          active ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          zIndex: PROMO_MODAL_Z,
          transitionDuration: `${active ? ENTER_MS : EXIT_MS}ms`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-bolao-home-promo-title"
        onClick={handleClose}
      >
        <div
          className={[
            "my-auto w-full max-w-[380px] transition-[opacity,transform] pointer-events-auto",
            active
              ? "scale-100 translate-y-0 opacity-100 ease-out"
              : "scale-[0.96] translate-y-3 opacity-0 ease-in",
          ].join(" ")}
          style={{
            transitionDuration: `${active ? ENTER_MS : EXIT_MS}ms`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DailyBolaoHomePromoModal onClose={handleClose} />
        </div>
      </div>
    ) : null;

  return (
    <>
      {children}
      {portalReady && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
