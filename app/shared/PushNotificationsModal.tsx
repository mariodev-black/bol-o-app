"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import { useAuth } from "@/app/shared/AuthContext";
import {
  enablePushNotifications,
  isStandalonePwa,
} from "@/lib/push/client";
import {
  canRequestPushInThisContext,
  clearPushModalPending,
  PWA_INSTALLED_EVENT,
  persistPushPromptDismissed,
  shouldOfferPushNotificationsModal,
} from "@/lib/push/push-prompt";

const OPEN_DELAY_MS = 600;

export function PushNotificationsModal() {
  const { ready, isLoggedIn } = useAuth();
  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsStandalone, setNeedsStandalone] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const tryOpen = useCallback(() => {
    if (!shouldOfferPushNotificationsModal(ready, isLoggedIn)) {
      setOpen(false);
      return;
    }
    setNeedsStandalone(!canRequestPushInThisContext());
    setMessage(null);
    setOpen(true);
  }, [ready, isLoggedIn]);

  useEffect(() => {
    if (!ready || !isLoggedIn) return;

    const scheduleOpen = () => {
      const t = window.setTimeout(() => tryOpen(), OPEN_DELAY_MS);
      return () => window.clearTimeout(t);
    };

    let cleanup = scheduleOpen();

    const onPwaInstalled = () => {
      cleanup?.();
      cleanup = scheduleOpen();
    };

    const onDisplayMode = () => {
      if (isStandalonePwa()) {
        cleanup?.();
        cleanup = scheduleOpen();
      }
    };

    window.addEventListener(PWA_INSTALLED_EVENT, onPwaInstalled);
    window
      .matchMedia("(display-mode: standalone)")
      .addEventListener("change", onDisplayMode);

    return () => {
      cleanup?.();
      window.removeEventListener(PWA_INSTALLED_EVENT, onPwaInstalled);
      window
        .matchMedia("(display-mode: standalone)")
        .removeEventListener("change", onDisplayMode);
    };
  }, [ready, isLoggedIn, tryOpen]);

  const handleDismiss = useCallback(() => {
    persistPushPromptDismissed();
    clearPushModalPending();
    setOpen(false);
  }, []);

  const handleEnable = useCallback(async () => {
    if (!canRequestPushInThisContext()) {
      setNeedsStandalone(true);
      setMessage("Abra o app pelo ícone na tela inicial do iPhone e toque em Ativar.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await enablePushNotifications();
    setLoading(false);

    if (result.ok) {
      persistPushPromptDismissed();
      clearPushModalPending();
      setOpen(false);
      return;
    }

    if (result.reason === "denied") {
      setMessage("Permissão negada. Você pode ativar depois nas configurações do sistema.");
      persistPushPromptDismissed();
      clearPushModalPending();
    } else if (result.reason === "no-vapid") {
      setMessage("Notificações temporariamente indisponíveis. Tente mais tarde.");
    } else {
      setMessage("Não foi possível ativar agora. Tente novamente pelo app instalado.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, handleDismiss]);

  if (!open || !portalReady) return null;

  const installed = isStandalonePwa();

  return createPortal(
    <div
      className="fixed inset-0 z-[135] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-notifications-modal-title"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/82 backdrop-blur-[3px]"
        aria-label="Fechar"
        onClick={handleDismiss}
      />

      <div className="animate-perfil-avatar-sheet-in relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-white/12 bg-[#101010] shadow-[0_-16px_56px_rgba(0,0,0,0.6)] sm:rounded-2xl sm:shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={logoApp}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-[12px] object-contain"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                {installed ? "App instalado" : "Quase lá"}
              </p>
              <h2
                id="push-notifications-modal-title"
                className="font-helvetica-now-display text-[18px] font-black uppercase leading-tight tracking-wide text-white"
              >
                Ativar notificações
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="text-[14px] font-medium leading-relaxed text-white/55">
            {needsStandalone && !installed
              ? "Abra o Bolão do Milhão pelo ícone na tela inicial para liberar as notificações no iPhone."
              : "Receba avisos de prazos de palpite, rodadas e novidades — mesmo com o app fechado."}
          </p>

          <ul className="space-y-2.5">
            {[
              "Lembretes antes do fechamento dos palpites",
              "Avisos de resultados e premiação",
              "Comunicados importantes do bolão",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2.5 text-[13px] font-medium text-white/75">
                <Bell
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {message ? (
            <p className="rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-[12px] font-bold text-amber-200/90">
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading || (needsStandalone && !installed)}
              onClick={() => void handleEnable()}
              className="flex h-12 w-full items-center justify-center rounded-xl text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98] disabled:opacity-45"
              style={{
                background: "#B1EB0B",
                boxShadow: "0 0 16px rgba(177,235,11,0.22)",
              }}
            >
              {loading ? "Ativando..." : "Ativar notificações"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-white/5 text-[11px] font-black uppercase tracking-wide text-white/55 transition-colors hover:bg-white/8 hover:text-white/75"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
